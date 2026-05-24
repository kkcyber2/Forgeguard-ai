import { NextResponse } from "next/server";
import {
  engineAuthHeaders,
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";

/**
 * GET /api/health/engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight liveness probe for the Railway orchestrator (Agathon).
 * Called by the dashboard's <EngineStatus /> component every 30 seconds.
 *
 * Status semantics:
 *   "unconfigured" — PYTHON_ENGINE_URL / AGATHON_ORCHESTRATOR_URL absent.
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
  const baseUrl = resolveEngineBaseUrl();
  const authHeader = engineAuthHeaders();

  if (!baseUrl) {
    console.warn(
      "[api/health/engine] Unconfigured: set PYTHON_ENGINE_URL or AGATHON_ORCHESTRATOR_URL on Vercel",
    );
    return NextResponse.json({
      ok: true,
      status: "unconfigured",
      latencyMs: 0,
    });
  }

  if (!resolveEngineAuthToken()) {
    console.warn(
      "[api/health/engine] No auth token: set INTERNAL_SCAN_TOKEN or AGATHON_INTERNAL_SECRET on Vercel",
    );
  }

  const t0 = Date.now();
  const healthUrl = `${baseUrl}/health`;

  try {
    const resp = await fetch(healthUrl, {
      method: "GET",
      headers: {
        ...(authHeader ?? {}),
        "Cache-Control": "no-store",
      },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    const latencyMs = Date.now() - t0;

    if (resp.ok) {
      return NextResponse.json({ ok: true, status: "healthy", latencyMs });
    }

    const body = await resp.text().catch(() => "<no body>");
    console.error("[api/health/engine] Engine returned non-2xx:", {
      url: healthUrl,
      httpStatus: resp.status,
      statusText: resp.statusText,
      body: body.slice(0, 500),
      latencyMs,
    });

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
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[api/health/engine] Engine ping failed:", {
      url: healthUrl,
      message,
      stack,
      latencyMs,
      err,
    });

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
