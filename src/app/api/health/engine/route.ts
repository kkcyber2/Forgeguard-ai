import { NextResponse } from "next/server";
import {
  buildEngineHealthUrl,
  engineAuthHeaders,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";

/**
 * GET /api/health/engine — fail-fast bunker liveness (5s max).
 * Returns BUNKER_SLEEP when Railway does not answer — never blocks Vercel for 60s.
 */
export const maxDuration = 10;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAILFAST_MS = 5_000;
const SWR_HEADER = "private, max-age=0, stale-while-revalidate=30";

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  );
}

export async function GET() {
  const t0 = Date.now();
  const baseUrl = resolveEngineBaseUrl();

  // #region agent log
  fetch("http://127.0.0.1:7434/ingest/9739fdfe-4a94-4d0e-8d13-8449868d349d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c20499" },
    body: JSON.stringify({
      sessionId: "c20499",
      hypothesisId: "H1",
      location: "api/health/engine:GET:entry",
      message: "Engine health probe start",
      data: { baseUrlSet: Boolean(baseUrl), tokenSet: Boolean(engineAuthHeaders()) },
      timestamp: Date.now(),
      runId: "launch-check",
    }),
  }).catch(() => {});
  // #endregion

  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        status: "unconfigured",
        latencyMs: 0,
        reason: "PYTHON_ENGINE_URL not set",
      },
      { headers: { "Cache-Control": SWR_HEADER } },
    );
  }

  const auth = engineAuthHeaders();
  if (!auth) {
    return NextResponse.json(
      {
        ok: false,
        status: "unconfigured",
        latencyMs: 0,
        reason: "INTERNAL_SCAN_TOKEN not set",
      },
      { headers: { "Cache-Control": SWR_HEADER } },
    );
  }

  const healthUrl = buildEngineHealthUrl(baseUrl);

  try {
    const resp = await fetch(healthUrl, {
      method: "GET",
      headers: { ...auth, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(FAILFAST_MS),
      cache: "no-store",
    });

    const latencyMs = Date.now() - t0;

    // #region agent log
    fetch("http://127.0.0.1:7434/ingest/9739fdfe-4a94-4d0e-8d13-8449868d349d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c20499" },
      body: JSON.stringify({
        sessionId: "c20499",
        hypothesisId: "H1",
        location: "api/health/engine:GET:result",
        message: "Engine health probe result",
        data: { ok: resp.ok, httpStatus: resp.status, latencyMs },
        timestamp: Date.now(),
        runId: "launch-check",
      }),
    }).catch(() => {});
    // #endregion

    if (resp.ok) {
      let engineMeta: Record<string, unknown> = {};
      try {
        engineMeta = (await resp.json()) as Record<string, unknown>;
      } catch {
        /* body optional */
      }
      return NextResponse.json(
        {
          ok: true,
          status: "healthy",
          latencyMs,
          engine: engineMeta,
        },
        { headers: { "Cache-Control": SWR_HEADER } },
      );
    }

    const bodySnippet = (await resp.text().catch(() => "")).slice(0, 300);
    const bunkerSleep = resp.status === 499 || resp.status === 502 || resp.status === 503 || resp.status === 504;

    return NextResponse.json(
      {
        ok: false,
        status: bunkerSleep ? "BUNKER_SLEEP" : "lockdown",
        latencyMs,
        httpStatus: resp.status,
        reason: bunkerSleep
          ? "Engine bunker asleep or unreachable"
          : "Engine returned non-OK status",
        error: bodySnippet || undefined,
      },
      { headers: { "Cache-Control": SWR_HEADER } },
    );
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const timedOut = isTimeoutError(err);
    return NextResponse.json(
      {
        ok: false,
        status: "BUNKER_SLEEP",
        latencyMs,
        reason: timedOut
          ? `No engine response within ${FAILFAST_MS / 1000}s`
          : "Engine probe failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { headers: { "Cache-Control": SWR_HEADER } },
    );
  }
}
