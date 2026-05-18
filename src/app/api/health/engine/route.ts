import { NextResponse } from "next/server";

/**
 * GET /api/health/engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight liveness probe for the Railway orchestrator (Agathon).
 * Called by the dashboard's <EngineStatus /> component every 30 seconds.
 *
 * Status semantics:
 *   "unconfigured" — AGATHON_ORCHESTRATOR_URL is absent (dev / preview env).
 *                    Client should stay silent; this is expected in local dev.
 *   "healthy"      — Orchestrator responded 2xx within the timeout window.
 *   "degraded"     — Orchestrator responded but with a non-2xx status.
 *   "offline"      — Fetch timed out or threw a network error.
 *
 * Always returns HTTP 200 so the client can read the JSON regardless of
 * orchestrator state. Engine errors are communicated in the response body,
 * not via HTTP status, to avoid false-positive error-boundary triggers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.AGATHON_ORCHESTRATOR_URL?.replace(/\/$/, "");
  const secret  = process.env.AGATHON_INTERNAL_SECRET;

  // Not wired up yet (local dev / preview deployment).
  if (!baseUrl) {
    return NextResponse.json({
      ok: true,
      status: "unconfigured",
      latencyMs: 0,
    });
  }

  const t0 = Date.now();

  try {
    const resp = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        "Cache-Control": "no-store",
      },
      signal: AbortSignal.timeout(5_000),   // 5 s hard cap
      cache: "no-store",
    });

    const latencyMs = Date.now() - t0;

    if (resp.ok) {
      return NextResponse.json({ ok: true, status: "healthy", latencyMs });
    }

    return NextResponse.json({
      ok: false,
      status: "degraded",
      latencyMs,
      httpStatus: resp.status,
    });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json({
      ok: false,
      status: "offline",
      latencyMs,
      error: message,
    });
  }
}
