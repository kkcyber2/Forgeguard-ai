import {
  buildEngineHealthUrl,
  directPingEngine,
  engineAuthHeaders,
  logEngineHandshakeDiagnostics,
  logEngineProbeTarget,
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
  sanitizeHttpHeaderValue,
} from "@/lib/agathon-config";
import { coalesce } from "@/lib/cache/fetch-coalesce";
import {
  swrGet,
  swrIsFresh,
  swrIsStaleUsable,
  swrSet,
} from "@/lib/cache/stale-while-revalidate";

export type EngineHealthSnapshot = {
  ok: boolean;
  status: "unconfigured" | "healthy" | "lockdown" | "offline";
  latencyMs: number;
  reason?: string;
  httpStatus?: number;
  error?: string;
};

const CACHE_KEY = "engine:health";
const FRESH_MS = 15_000;
const STALE_MS = 60_000;
const BUNKER_RETRY_MS = 2_000;
const PROBE_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function offlineSnapshot(error?: string): EngineHealthSnapshot {
  return {
    ok: false,
    status: "offline",
    latencyMs: 0,
    reason: "Engine bunker unreachable",
    error: error ?? "Engine probe failed",
  };
}

function sanitizeAuthHeaders(
  auth: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(auth)) {
    out[sanitizeHttpHeaderValue(k)] = sanitizeHttpHeaderValue(v);
  }
  return out;
}

async function probeOnce(
  healthUrl: string,
  headers: Record<string, string>,
): Promise<EngineHealthSnapshot> {
  const t0 = Date.now();
  try {
    const resp = await fetch(healthUrl, {
      method: "GET",
      headers: { ...headers, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Date.now() - t0;

    if (resp.ok) {
      return { ok: true, status: "healthy", latencyMs };
    }

    const bodySnippet = (await resp.text().catch(() => "")).slice(0, 200);
    console.error(
      "ENGINE_PROBE_STATUS:",
      resp.status,
      bodySnippet || "<empty body>",
    );

    return {
      ok: false,
      status: "lockdown",
      latencyMs,
      reason: "Engine bunker unreachable",
      httpStatus: resp.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      status: "offline",
      latencyMs: Date.now() - t0,
      reason: "Engine bunker unreachable",
      error: message,
    };
  }
}

async function fetchEngineHealth(): Promise<EngineHealthSnapshot> {
  try {
    const baseUrl = resolveEngineBaseUrl();
    const token = resolveEngineAuthToken();

    logEngineHandshakeDiagnostics();
    logEngineProbeTarget(baseUrl);

    if (!baseUrl) {
      return { ok: true, status: "unconfigured", latencyMs: 0 };
    }
    if (!token) {
      return {
        ok: true,
        status: "unconfigured",
        latencyMs: 0,
        reason: "Missing INTERNAL_SCAN_TOKEN",
      };
    }

    const authHeader = engineAuthHeaders();
    if (!authHeader) {
      return {
        ok: true,
        status: "unconfigured",
        latencyMs: 0,
        reason: "Auth unavailable",
      };
    }

    const healthUrl = buildEngineHealthUrl(baseUrl);
    const safeHeaders = sanitizeAuthHeaders(authHeader);
    let snapshot = await probeOnce(healthUrl, safeHeaders);

    const shouldRetry =
      !snapshot.ok &&
      (snapshot.httpStatus === 503 ||
        snapshot.status === "lockdown" ||
        snapshot.status === "offline");

    if (shouldRetry) {
      console.error(
        "[engine] bunker fallback: retrying after",
        BUNKER_RETRY_MS,
        "ms (status",
        snapshot.httpStatus ?? snapshot.status,
        ")",
      );
      await sleep(BUNKER_RETRY_MS);
      snapshot = await probeOnce(healthUrl, safeHeaders);
      if (snapshot.ok) {
        console.error("[engine] bunker fallback: retry succeeded");
      } else {
        console.error(
          "[engine] bunker fallback: retry failed",
          snapshot.httpStatus ?? snapshot.error ?? snapshot.status,
        );
        await directPingEngine();
      }
    } else if (!snapshot.ok && snapshot.status !== "unconfigured") {
      await directPingEngine();
    }

    return snapshot;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[engine] fetchEngineHealth:", message);
    return offlineSnapshot(message);
  }
}

function refreshInBackground(): void {
  void coalesce("engine:health:refresh", async () => {
    const snapshot = await fetchEngineHealth();
    swrSet(CACHE_KEY, snapshot, FRESH_MS, STALE_MS);
    return snapshot;
  });
}

/**
 * Returns cached engine health; revalidates in background when stale.
 */
export async function getEngineHealthSnapshot(): Promise<EngineHealthSnapshot> {
  try {
    const cached = swrGet<EngineHealthSnapshot>(CACHE_KEY);

    if (swrIsFresh(cached)) {
      return cached!.value;
    }

    if (swrIsStaleUsable(cached)) {
      refreshInBackground();
      return cached!.value;
    }

    return coalesce(CACHE_KEY, async () => {
      const snapshot = await fetchEngineHealth();
      swrSet(CACHE_KEY, snapshot, FRESH_MS, STALE_MS);
      return snapshot;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[engine] getEngineHealthSnapshot:", message);
    return offlineSnapshot(message);
  }
}

export function isEngineLockdown(snapshot: EngineHealthSnapshot): boolean {
  return (
    !snapshot.ok &&
    (snapshot.status === "lockdown" || snapshot.status === "offline")
  );
}
