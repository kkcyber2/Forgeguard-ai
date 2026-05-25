/**
 * GET /api/bazaar/list
 * ─────────────────────────────────────────────────────────────────────────────
 * Paginated listing of published, cleared Bazaar scripts.
 * Query params: ?page=1&limit=20&tag=recon&lang=python&free=true
 * Returns scripts WITHOUT the `code` field (revealed on purchase only).
 */

import { NextResponse, type NextRequest } from "next/server";
import { operatorAlias } from "@/lib/access/ghost-mode";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthorRow = {
  id: string;
  full_name: string | null;
  hacker_rank: string | null;
  is_ghost_active: boolean | null;
};

function maskAuthor(author: AuthorRow | null) {
  if (!author) return null;

  if (author.is_ghost_active) {
    const alias = operatorAlias(author.id);
    return {
      id: author.id,
      full_name: alias,
      username: alias,
      rank: author.hacker_rank ?? "ELITE",
      is_ghost: true as const,
    };
  }

  return {
    id: author.id,
    full_name: author.full_name ?? "anon",
    username: author.full_name?.split(" ")[0]?.toLowerCase() ?? "anon",
    rank: author.hacker_rank ?? "RECRUIT",
    is_ghost: false as const,
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const url = req.nextUrl;
  const page    = Math.max(1,  Number(url.searchParams.get("page")  ?? 1));
  const limit   = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const tag     = url.searchParams.get("tag")  ?? null;
  const lang    = url.searchParams.get("lang") ?? null;
  const freeOnly = url.searchParams.get("free") === "true";
  const certifiedOnly = url.searchParams.get("certified") === "1";
  const offset  = (page - 1) * limit;

  let query = supabase
    .from("bazaar_scripts")
    .select(`
      id, name, description, language, tags,
      price_usd, is_free, purchase_count,
      audit_verdict, audit_risk_score,
      is_published, is_certified, created_at, updated_at,
      author:author_id (
        id, full_name, hacker_rank, is_ghost_active
      )
    `, { count: "exact" })
    .eq("is_published", true)
    .eq("is_removed",   false)
    .eq("audit_verdict", "cleared")
    .order("purchase_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (certifiedOnly) query = query.eq("is_certified", true);

  if (tag)      query = query.contains("tags", [tag]);
  if (lang)     query = query.eq("language", lang);
  if (freeOnly) query = query.eq("is_free",  true);

  const { data: scripts, count, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  let purchased: Set<string> = new Set();
  if (user) {
    const { data: purchaseRows } = await supabase
      .from("bazaar_purchases")
      .select("script_id")
      .eq("buyer_id", user.id);
    purchased = new Set(
      (purchaseRows ?? [])
        .map((r) => r.script_id)
        .filter((id): id is string => id != null),
    );
  }

  const enriched = (scripts ?? []).map((s) => {
    const rawAuthor = s.author as AuthorRow | AuthorRow[] | null;
    const authorRow = Array.isArray(rawAuthor) ? rawAuthor[0] ?? null : rawAuthor;

    return {
      ...s,
      author: maskAuthor(authorRow),
      is_purchased: purchased.has(s.id),
    };
  });

  return NextResponse.json({
    ok:      true,
    scripts: enriched,
    total:   count ?? 0,
    page,
    limit,
  });
}
