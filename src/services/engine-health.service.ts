"use client";

/**
 * Client singleton for /api/health/engine — one poll stream, bunker retry on offline.
 * Polling pauses while the tab is hidden to reduce setInterval lag.
 */

import {
  BUNKER_RETRY_MS,
  BUNKER_SHIELDING_MESSAGE,
} from "@/lib/engine/bunker-shielding";

export type ClientEngineHealth = {
  ok: boolean;
  status: string;
  latencyMs: number;
  reason?: string;
};

type Listener = (health: ClientEngineHealth) => void;

const POLL_MS = 30_000;

let health: ClientEngineHealth | null = null;
let inflight: Promise<ClientEngineHealth> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let visibilityBound = false;
const listeners = new Set<Listener>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopPolling(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startPolling(): void {
  if (intervalId) return;
  if (typeof document !== "undefined" && document.hidden) return;
  void probe();
  intervalId = setInterval(() => void probe(), POLL_MS);
}

function bindVisibilityPause(): void {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
    } else if (listeners.size > 0) {
      startPolling();
    }
  });
}

function isEngineDown(data: ClientEngineHealth): boolean {
  return (
    !data.ok &&
    (data.status === "lockdown" ||
      data.status === "offline" ||
      data.status === "unconfigured")
  );
}

async function fetchHealthOnce(): Promise<ClientEngineHealth> {
  const res = await fetch("/api/health/engine", { cache: "no-store" });
  return (await res.json()) as ClientEngineHealth;
}

async function probeWithBunkerFallback(): Promise<ClientEngineHealth> {
  try {
    let data = await fetchHealthOnce();

    if (isEngineDown(data) && data.status !== "unconfigured") {
      console.error(
        "[engine-health] client bunker fallback in",
        BUNKER_RETRY_MS,
        "ms",
      );
      await sleep(BUNKER_RETRY_MS);
      data = await fetchHealthOnce();
    }

    health = data;
    listeners.forEach((fn) => fn(data));
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[engine-health] probe failed:", message);
    await sleep(BUNKER_RETRY_MS);
    try {
      const retry = await fetchHealthOnce();
      health = retry;
      listeners.forEach((fn) => fn(retry));
      return retry;
    } catch {
      const offline: ClientEngineHealth = {
        ok: false,
        status: "offline",
        latencyMs: 0,
        reason: BUNKER_SHIELDING_MESSAGE,
      };
      health = offline;
      listeners.forEach((fn) => fn(offline));
      return offline;
    }
  }
}

async function probe(): Promise<ClientEngineHealth> {
  if (inflight) return inflight;

  inflight = probeWithBunkerFallback().finally(() => {
    inflight = null;
  });

  return inflight;
}

function ensurePolling(): void {
  bindVisibilityPause();
  startPolling();
}

/** Subscribe to shared engine health polls. */
export function subscribeEngineHealth(listener: Listener): () => void {
  listeners.add(listener);
  ensurePolling();
  if (health) listener(health);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopPolling();
    }
  };
}

export function getCachedEngineHealth(): ClientEngineHealth | null {
  return health;
}

export function refreshEngineHealth(): Promise<ClientEngineHealth> {
  return probe();
}
