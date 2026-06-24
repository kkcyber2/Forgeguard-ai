import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ingestCveAlmanacEntries } from "@/lib/almanac/cve-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/almanac-cve
 * Optional daily ingest of public CISA KEV entries with LLM-related keywords.
 * Protect with CRON_SECRET (Vercel Cron or manual operator call).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminSupabase();
    const result = await ingestCveAlmanacEntries(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "CVE ingest failed";
    console.error("[cron:almanac-cve]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
