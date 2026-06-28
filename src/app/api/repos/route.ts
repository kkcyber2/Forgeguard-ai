/**
 * GET  /api/repos        — list public repos (or authed user's repos)
 * POST /api/repos        — create new repo
 * PUT  /api/repos        — update repo (code / visibility)
 */

import { NextResponse, type NextRequest } from "next/server";
import type { TablesUpdate } from "@/types/supabase";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name:        z.string().min(2).max(60).regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, _ and - allowed"),
  description: z.string().max(300).default(""),
  language:    z.enum(["python", "bash", "javascript", "rust"]).default("python"),
  tags:        z.array(z.string().max(30)).max(8).default([]),
  code:        z.string().max(100_000).default(""),
  is_public:   z.boolean().default(false),
});

const UpdateSchema = z.object({
  id:          z.string().uuid(),
  description: z.string().max(300).optional(),
  code:        z.string().max(100_000).optional(),
  is_public:   z.boolean().optional(),
  is_archived: z.boolean().optional(),
  version:     z.string().max(20).optional(),
  tags:        z.array(z.string().max(30)).max(8).optional(),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const url     = req.nextUrl;
  const mine    = url.searchParams.get("mine")  === "true";
  const page    = Math.max(1,  Number(url.searchParams.get("page")  ?? 1));
  const limit   = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const lang    = url.searchParams.get("lang") ?? null;
  const offset  = (page - 1) * limit;

  if (mine && !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let query = supabase
    .from("hacker_repos")
    .select(`
      id, owner_id, name, description, language, tags,
      is_public, is_archived, star_count, version, commit_count,
      created_at, updated_at,
      owner:owner_id ( full_name, hacker_rank )
    `, { count: "exact" })
    .order("star_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (mine && user) {
    query = query.eq("owner_id", user.id);
  } else {
    query = query.eq("is_public",   true)
                 .eq("is_archived", false);
  }

  if (lang) query = query.eq("language", lang);

  const { data: repos, count, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  // Attach starred flag for authed user
  let starred: Set<string> = new Set();
  if (user) {
    const { data: starRows } = await supabase
      .from("repo_stars")
      .select("repo_id")
      .eq("user_id", user.id);
    starred = new Set((starRows ?? []).map((r: { repo_id: string }) => r.repo_id));
  }

  const enriched = (repos ?? []).map((r) => ({
    ...r,
    is_starred: starred.has(r.id),
  }));

  return NextResponse.json({ ok: true, repos: enriched, total: count ?? 0, page, limit });
}

// ─── POST (create) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // Access gate: hacker or developer
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle();

  if (((profile?.access_level as number | undefined) ?? 1) < 2) {
    return NextResponse.json(
      { ok: false, error: "Hacker rank required to create repos.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  const { data: repo, error: insertErr } = await supabase
    .from("hacker_repos")
    .insert({ owner_id: user.id, ...parsed.data })
    .select("id, name, is_public, star_count")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "A repo with this name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, repo });
}

// ─── PUT (update) ─────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  const { id, ...updates } = parsed.data;

  // Build update patch — commit_count increment handled server-side via DB trigger if needed
  const patch = { ...updates } as TablesUpdate<"hacker_repos">;

  const { data: repo, error: updateErr } = await supabase
    .from("hacker_repos")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id)  // RLS enforcement at query level too
    .select("id, name, is_public, star_count, version, commit_count")
    .single();

  if (updateErr || !repo) {
    return NextResponse.json({ ok: false, error: "Not found or unauthorised" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, repo });
}
