/**
 * POST /api/repos/star   — toggle star on a repo
 * DELETE /api/repos/star — unstar (body: { repo_id })
 *
 * Legend-rank requirement: access_level ≥ 3 to star other people's repos
 * (own repos cannot be starred by owner).
 *
 * Side-effects (via DB trigger sync_star_reputation):
 *   - repo.star_count ±1
 *   - owner profile.reputation ±10
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StarSchema = z.object({ repo_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = StarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "repo_id required" }, { status: 400 });
  }

  const { repo_id } = parsed.data;

  // Load repo
  const { data: repo } = await supabase
    .from("hacker_repos")
    .select("id, owner_id, is_public")
    .eq("id", repo_id)
    .maybeSingle();

  if (!repo) {
    return NextResponse.json({ ok: false, error: "Repo not found" }, { status: 404 });
  }

  if (!repo.is_public) {
    return NextResponse.json({ ok: false, error: "Cannot star a private repo" }, { status: 403 });
  }

  if (repo.owner_id === user.id) {
    return NextResponse.json({ ok: false, error: "Cannot star your own repo" }, { status: 400 });
  }

  // Legend-rank check (access_level ≥ 3)
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle();

  const level = (profile?.access_level as number | undefined) ?? 1;
  if (level < 3) {
    return NextResponse.json(
      { ok: false, error: "Legend rank required to star repositories.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  // Upsert star (idempotent — unique constraint on repo_id + user_id)
  const { error: starErr } = await supabase
    .from("repo_stars")
    .insert({ repo_id, user_id: user.id });

  if (starErr) {
    if (starErr.code === "23505") {
      return NextResponse.json({ ok: true, already_starred: true });
    }
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  // Fetch updated star count
  const { data: updated } = await supabase
    .from("hacker_repos")
    .select("star_count")
    .eq("id", repo_id)
    .single();

  return NextResponse.json({ ok: true, starred: true, star_count: updated?.star_count ?? 0 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = StarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "repo_id required" }, { status: 400 });
  }

  const { repo_id } = parsed.data;

  await supabase
    .from("repo_stars")
    .delete()
    .eq("repo_id", repo_id)
    .eq("user_id", user.id);

  const { data: updated } = await supabase
    .from("hacker_repos")
    .select("star_count")
    .eq("id", repo_id)
    .single();

  return NextResponse.json({ ok: true, starred: false, star_count: updated?.star_count ?? 0 });
}
