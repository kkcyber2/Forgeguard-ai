/**
 * lib/evolution/stats.ts — fetch self-evolution telemetry from the Agathon engine.
 *
 * Server-only. Calls the bearer-gated `GET /evolve/stats` endpoint and returns
 * a typed snapshot for the admin Evolution page. Returns null when the engine
 * is unreachable so the page degrades gracefully instead of erroring.
 */

import "server-only";

import {
  engineAuthHeaders,
  joinEnginePath,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";

export interface EvolveMetrics {
  plugin_discovery_count: number;
  lessons_persisted: number;
  lessons_loaded: number;
  closed_loop_attempts: number;
  closed_loop_blocks: number;
  closed_loop_block_rate: number;
  breaches_after_lesson: number;
  attacks_run_by_surface: Record<string, number>;
}

export interface TopFamilyBreached {
  family: string | null;
  breach_count: number;
  fail_count: number;
}

export interface EvolveStats {
  ok: boolean;
  metrics: EvolveMetrics;
  top_families_breached: TopFamilyBreached[];
}

const EMPTY_METRICS: EvolveMetrics = {
  plugin_discovery_count: 0,
  lessons_persisted: 0,
  lessons_loaded: 0,
  closed_loop_attempts: 0,
  closed_loop_blocks: 0,
  closed_loop_block_rate: 0,
  breaches_after_lesson: 0,
  attacks_run_by_surface: {},
};

/**
 * Fetch `/evolve/stats` from the engine. Best-effort — returns a null-safe
 * shape on any failure so the admin page never throws.
 */
export async function fetchEvolveStats(): Promise<EvolveStats | null> {
  const base = resolveEngineBaseUrl();
  if (!base) return null;
  const headers = engineAuthHeaders();
  if (!headers) return null;

  const url = joinEnginePath(base, "/evolve/stats");
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...headers, "Cache-Control": "no-store" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Partial<EvolveStats>;
    if (!data || data.ok !== true) return null;
    return {
      ok: true,
      metrics: { ...EMPTY_METRICS, ...(data.metrics ?? {}) },
      top_families_breached: data.top_families_breached ?? [],
    };
  } catch {
    return null;
  }
}
