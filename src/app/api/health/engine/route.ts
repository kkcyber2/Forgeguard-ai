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
 *                    Returns HTTP 200.
 *   "healthy"      — Orchestrator responded 2xx within the timeout window.
 *                    Returns HTTP 200.
 *   "lockdown"     — Orchestrator is degraded or offline.
 *                    Returns HTTP 503 { status: "lockdown", reason: "Engine Overload" }.
 *                    Footer badge pulses red when this status is detected client-side.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.AGATHON_ORCHESTRATOR_URL?.replace(/\/$/, "");
  const secret  = process.env.INTERNAL_SCAN_TOKEN;

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

    // Non-2xx from Railway → engine overload / lockdown
    return NextResponse.json(
      {
        ok: false,
        status: "lockdown",
        reason: "Engine Overload",
        latencyMs,
        httpStatus: resp.status,
      },
      { status: 503 },
    );
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const message =
      err instanceof Error ? err.message : "Unknown error";

    // Network error / timeout → engine offline → lockdown
    return NextResponse.json(
      {
        ok: false,
        status: "lockdown",
        reason: "Engine Overload",
        latencyMs,
        error: message,
      },
      { status: 503 },
    );
  }
}
