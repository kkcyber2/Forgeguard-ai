import { NextResponse } from "next/server";
import {
  logEngineHandshakeDiagnostics,
  logEngineProbeTarget,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";
import {
  getEngineHealthSnapshot,
  isEngineLockdown,
} from "@/lib/engine/probe-engine-health";

/**
 * GET /api/health/engine — cached liveness probe with SWR + coalescing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SWR_HEADER = "private, max-age=0, stale-while-revalidate=60";

export async function GET() {
  const snapshot = await getEngineHealthSnapshot();

  const body = {
    ok: snapshot.ok,
    status: snapshot.status,
    latencyMs: snapshot.latencyMs,
    reason: snapshot.reason,
    httpStatus: snapshot.httpStatus,
    error: snapshot.error,
  };

  if (isEngineLockdown(snapshot)) {
    logEngineHandshakeDiagnostics();
    logEngineProbeTarget(resolveEngineBaseUrl());
    return NextResponse.json(body, {
      status: 503,
      headers: { "Cache-Control": SWR_HEADER },
    });
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": SWR_HEADER },
  });
}
