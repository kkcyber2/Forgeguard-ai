import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildEntityUpserts,
  extractEntitiesFromDomain,
} from "@/lib/citadel/fusion-ingest";
import { DEFAULT_COMPARTMENT_ID } from "@/lib/citadel/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron endpoint — run all agency watchlists (vault re-query stub).
 * Auth: CRON_SECRET header or ?secret= query param.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = new URL(request.url);
  const provided = header ?? url.searchParams.get("secret") ?? "";
  if (provided !== secret) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: lists } = await db.from("agency_watchlists").select("id");
  const results: Array<{ id: string; ingested: number }> = [];

  for (const row of lists ?? []) {
    const watchlistId = row.id as string;
    const { data: items } = await db
      .from("agency_watchlist_items")
      .select("raw_value")
      .eq("watchlist_id", watchlistId);

    const domains = (items ?? []).map((i: { raw_value: string }) => i.raw_value);
    let ingested = 0;

    for (const domain of domains) {
      const entities = extractEntitiesFromDomain(domain, {});
      const upserts = buildEntityUpserts(entities, null);
      if (upserts.length === 0) continue;
      const { error } = await db
        .from("agency_entities")
        .upsert(upserts, { onConflict: "compartment_id,entity_type,value" });
      if (!error) ingested += upserts.length;
    }

    await db
      .from("agency_watchlists")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", watchlistId);

    await db.from("agency_audit_events").insert({
      compartment_id: DEFAULT_COMPARTMENT_ID,
      actor_id: null,
      action: "watchlist_cron",
      target_type: "watchlist",
      target_id: watchlistId,
      meta: { ingested },
    });

    results.push({ id: watchlistId, ingested });
  }

  return NextResponse.json({ ok: true, ran: results.length, results });
}
