import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ingestCveAlmanacEntries } from "@/lib/almanac/cve-ingest";
import { ingestNvdAlmanacEntries } from "@/lib/almanac/nvd-ingest";
import { enrichAlmanacWithEpss } from "@/lib/almanac/epss-enrich";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/intel-sync
 * Phase 5 — unified Data Moat sync. Runs in sequence:
 *   1. CISA KEV ingest (LLM keywords)
 *   2. NVD CVE ingest  (AI/LLM keywords, throttled, no key)
 *   3. EPSS enrichment (fill epss_score/percentile on CVE entries)
 *
 * Protected by CRON_SECRET (Vercel Cron or manual operator call).
 * NVD throttle (~6.5s between keyword calls) makes this run >60s, so
 * maxDuration is raised to 300s.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const result: Record<string, unknown> = {};

  try {
    result.cisa_kev = await ingestCveAlmanacEntries(admin);
  } catch (e) {
    result.cisa_kev = { error: (e as Error).message };
    console.error("[cron:intel-sync] cisa_kev:", (e as Error).message);
  }

  try {
    result.nvd = await ingestNvdAlmanacEntries(admin);
  } catch (e) {
    result.nvd = { error: (e as Error).message };
    console.error("[cron:intel-sync] nvd:", (e as Error).message);
  }

  try {
    result.epss = await enrichAlmanacWithEpss(admin);
  } catch (e) {
    result.epss = { error: (e as Error).message };
    console.error("[cron:intel-sync] epss:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, ...result });
}
