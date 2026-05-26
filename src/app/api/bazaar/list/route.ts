/**
 * GET /api/bazaar/list
 * Paginated listing of published, cleared Bazaar scripts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listPublishedScripts, normalizeScript } from "@/lib/bazaar/list-scripts";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const tag = url.searchParams.get("tag") ?? null;
  const lang = url.searchParams.get("lang") ?? null;
  const freeOnly = url.searchParams.get("free") === "true";
  const certifiedOnly = url.searchParams.get("certified") === "1";

  const result = await listPublishedScripts(supabase, {
    page,
    limit,
    tag,
    lang,
    freeOnly,
    certifiedOnly,
  });

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  let purchased = new Set<string>();
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

  const enriched = result.scripts.map((s) => ({
    ...normalizeScript(s),
    is_purchased: purchased.has(s.id),
  }));

  return NextResponse.json({
    ok: true,
    scripts: enriched,
    total: result.count ?? 0,
    page,
    limit,
  });
}
