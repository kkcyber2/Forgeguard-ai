"use client";

/**
 * Client singleton for /api/health/engine — one poll stream, bunker retry on 503.
 */

export type ClientEngineHealth = {
  ok: boolean;
  status: string;
  latencyMs: number;
  reason?: string;
};

type Listener = (health: ClientEngineHealth) => void;

const BUNKER_RETRY_MS = 2_000;

let health: ClientEngineHealth | null = null;
let inflight: Promise<ClientEngineHealth> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

const POLL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHealthOnce(): Promise<ClientEngineHealth> {
  const res = await fetch("/api/health/engine", { cache: "no-store" });
  return (await res.json()) as ClientEngineHealth;
}

async function probeWithBunkerFallback(): Promise<ClientEngineHealth> {
  try {
    let data = await fetchHealthOnce();

    if (!data.ok && data.status === "lockdown") {
      console.error("[engine-health] client bunker fallback in", BUNKER_RETRY_MS, "ms");
      await sleep(BUNKER_RETRY_MS);
      data = await fetchHealthOnce();
    }

    health = data;
    listeners.forEach((fn) => fn(data));
    return data;
  } catch {
    const offline: ClientEngineHealth = {
      ok: false,
      status: "lockdown",
      latencyMs: 0,
      reason: "Engine bunker unreachable",
    };
    health = offline;
    listeners.forEach((fn) => fn(offline));
    return offline;
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
  if (intervalId) return;
  void probe();
  intervalId = setInterval(() => void probe(), POLL_MS);
}

/** Subscribe to shared engine health polls. */
export function subscribeEngineHealth(listener: Listener): () => void {
  listeners.add(listener);
  ensurePolling();
  if (health) listener(health);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function getCachedEngineHealth(): ClientEngineHealth | null {
  return health;
}

export function refreshEngineHealth(): Promise<ClientEngineHealth> {
  return probe();
}
