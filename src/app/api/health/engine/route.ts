import { NextResponse } from "next/server";
import {
  directPingEngine,
  logEngineHandshakeDiagnostics,
  logEngineProbeTarget,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";
import { getEngineHealthSnapshot } from "@/lib/engine/probe-engine-health";

/**
 * GET /api/health/engine — cached liveness probe with SWR + coalescing.
 * Always returns JSON (200) so the dashboard poller never crashes on 503/500.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SWR_HEADER = "private, max-age=0, stale-while-revalidate=60";

export async function GET() {
  try {
    const snapshot = await getEngineHealthSnapshot();

    const body = {
      ok: snapshot.ok,
      status: snapshot.status,
      latencyMs: snapshot.latencyMs,
      reason: snapshot.reason,
      httpStatus: snapshot.httpStatus,
      error: snapshot.error,
    };

    if (!snapshot.ok && snapshot.status !== "unconfigured") {
      logEngineHandshakeDiagnostics();
      logEngineProbeTarget(resolveEngineBaseUrl());
      await directPingEngine();
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": SWR_HEADER },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/health/engine] unhandled:", message);
    return NextResponse.json(
      {
        ok: false,
        status: "offline",
        latencyMs: 0,
        reason: "Bunker Shielding...",
        error: message,
      },
      { headers: { "Cache-Control": SWR_HEADER } },
    );
  }
}
