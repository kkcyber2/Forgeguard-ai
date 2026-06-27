import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 5 — EPSS enrichment (no API key).
 * -----------------------------------------------
 * EPSS (Exploit Prediction Scoring System) from First.org / Cyentific
 * gives a 0..1 exploit-likelihood score + percentile per CVE.
 *
 * Endpoint: https://epss.cymentific.com/api?cve=CVE-1,CVE-2,...
 * Batch up to BATCH_SIZE CVEs per request. We only enrich almanac
 * entries that have a cve_id and a null epss_percentile (idempotent).
 */

const EPSS_URL = "https://epss.cyentific.com/api";
const BATCH_SIZE = 100;

interface EpssRow {
  cve: string;
  epss: string;
  percentile: string;
}

interface EpssResponse {
  status?: string;
  data?: EpssRow[];
}

interface AlmanacCveRow {
  id: string;
  cve_id: string;
}

/** Enrich CVE-bearing almanac entries with EPSS scores (idempotent). */
export async function enrichAlmanacWithEpss(
  admin: SupabaseClient,
): Promise<{
  scanned: number;
  enriched: number;
  skipped: number;
  errors: number;
}> {
  // Collect entries with a cve_id that haven't been scored yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("vulnerability_almanac_entries")
    .select("id, cve_id")
    .not("cve_id", "is", null)
    .or("epss_percentile.is.null")
    .is("merged_into_id", null)
    .limit(1000) as { data: AlmanacCveRow[] | null; error: { message: string } | null };

  if (error) {
    console.error("[epss] fetch candidates:", error.message);
    return { scanned: 0, enriched: 0, skipped: 0, errors: 1 };
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { scanned: 0, enriched: 0, skipped: 0, errors: 0 };
  }

  // Build cve_id → [almanac ids] map (a CVE may appear on multiple rows).
  const cveToIds = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.cve_id.toUpperCase();
    const arr = cveToIds.get(key) ?? [];
    arr.push(r.id);
    cveToIds.set(key, arr);
  }

  const cveList = [...cveToIds.keys()];
  let enriched = 0;
  let errors = 0;
  let scanned = 0;

  for (let i = 0; i < cveList.length; i += BATCH_SIZE) {
    const batch = cveList.slice(i, i + BATCH_SIZE);
    const url = `${EPSS_URL}?cve=${batch.join(",")}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        errors += batch.length;
        continue;
      }
      const json = (await res.json()) as EpssResponse;
      const result = json.data ?? [];
      scanned += result.length;

      for (const row of result) {
        const score = parseFloat(row.epss);
        const percentile = parseFloat(row.percentile);
        if (Number.isNaN(score) || Number.isNaN(percentile)) continue;

        const ids = cveToIds.get(row.cve.toUpperCase());
        if (!ids?.length) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await (admin as any)
          .from("vulnerability_almanac_entries")
          .update({
            epss_score: score,
            epss_percentile: percentile,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (updErr) errors += ids.length;
        else enriched += ids.length;
      }
    } catch (e) {
      console.warn("[epss] batch failed:", (e as Error).message);
      errors += batch.length;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    scanned,
    enriched,
    skipped: rows.length - enriched,
    errors,
  };
}
