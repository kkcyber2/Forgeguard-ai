import { NextResponse } from "next/server";
import {
  ENGINE_HANDSHAKE_TIMEOUT_MS,
  engineAuthHeaders,
  resolveWarMachineBaseUrl,
  WAR_MACHINE_SCRAPE_HOURS,
} from "@/lib/agathon-config";
import { requireAdminProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/war-machine
 * Sovereign-only — dispatches Marine Swarm Product Hunt AI scraper on Railway.
 */
export async function POST() {
  const admin = await requireAdminProfile();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const base = resolveWarMachineBaseUrl();
  const headers = engineAuthHeaders();
  if (!base || !headers) {
    return NextResponse.json(
      { ok: false, error: "WAR_MACHINE_URL or INTERNAL_SCAN_TOKEN not configured" },
      { status: 503 },
    );
  }

  const url = `${base.replace(/\/+$/, "")}/scrape`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ hours: WAR_MACHINE_SCRAPE_HOURS, source: "producthunt_ai" }),
      signal: AbortSignal.timeout(ENGINE_HANDSHAKE_TIMEOUT_MS),
      cache: "no-store",
    });

    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: String(data.detail ?? data.error ?? `Engine ${resp.status}`) },
        { status: resp.status },
      );
    }

    return NextResponse.json({
      ok: true,
      ...data,
      operator: admin.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
