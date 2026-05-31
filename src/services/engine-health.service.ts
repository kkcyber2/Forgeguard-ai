"use client";

/**
 * Client singleton for /api/health/engine — one poll stream for all subscribers.
 */

export type ClientEngineHealth = {
  ok: boolean;
  status: string;
  latencyMs: number;
  reason?: string;
};

type Listener = (health: ClientEngineHealth) => void;

let health: ClientEngineHealth | null = null;
let inflight: Promise<ClientEngineHealth> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

const POLL_MS = 30_000;

async function probe(): Promise<ClientEngineHealth> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/health/engine", { cache: "no-store" });
      const data = (await res.json()) as ClientEngineHealth;
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
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function ensurePolling(): void {
  if (intervalId) return;
  void probe();
  intervalId = setInterval(() => void probe(), POLL_MS);
}

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
