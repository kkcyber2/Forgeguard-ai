import {
  engineAuthHeaders,
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";
import { coalesce } from "@/lib/cache/fetch-coalesce";
import {
  swrGet,
  swrIsFresh,
  swrIsStaleUsable,
  swrSet,
  type SwrEntry,
} from "@/lib/cache/stale-while-revalidate";

export type EngineHealthSnapshot = {
  ok: boolean;
  status: "unconfigured" | "healthy" | "lockdown";
  latencyMs: number;
  reason?: string;
  httpStatus?: number;
  error?: string;
};

const CACHE_KEY = "engine:health";
const FRESH_MS = 15_000;
const STALE_MS = 60_000;

async function fetchEngineHealth(): Promise<EngineHealthSnapshot> {
  const baseUrl = resolveEngineBaseUrl();
  const token = resolveEngineAuthToken();

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
    return { ok: true, status: "unconfigured", latencyMs: 0, reason: "Auth unavailable" };
  }

  const t0 = Date.now();
  const healthUrl = `${baseUrl}/health`;

  try {
    const resp = await fetch(healthUrl, {
      method: "GET",
      headers: { ...authHeader, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const latencyMs = Date.now() - t0;

    if (resp.ok) {
      return { ok: true, status: "healthy", latencyMs };
    }

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
      status: "lockdown",
      latencyMs: Date.now() - t0,
      reason: "Engine bunker unreachable",
      error: message,
    };
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
}

export function isEngineLockdown(snapshot: EngineHealthSnapshot): boolean {
  return snapshot.status === "lockdown" && !snapshot.ok;
}
