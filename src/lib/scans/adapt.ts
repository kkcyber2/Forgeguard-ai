import type { ScanCardData } from "@/components/dashboard/scan-card";
import type { Database } from "@/types/supabase";

/**
 * Adapters bridging the canonical `scans` / `scan_logs` database shape
 * to the generic UI primitives (`ScanCard`, `EventStream`, …) which use
 * their own vocabulary inherited from the earlier submissions model.
 *
 * Keeping this mapping in one place means we can refactor column names
 * or add new states without touching component internals.
 */

type ScanRow = Pick<
  Database["public"]["Tables"]["scans"]["Row"],
  | "id"
  | "target_model"
  | "target_url"
  | "status"
  | "progress_pct"
  | "finding_count"
  | "high_severity_count"
  | "created_at"
>;

/** Map engine-side status → UI-side status (ScanCardData vocabulary). */
export function toCardStatus(s: Database["public"]["Tables"]["scans"]["Row"]["status"]): ScanCardData["status"] {
  switch (s) {
    case "queued":
      return "pending";
    case "probing":
      return "in_progress";
    case "triage":
      return "review";
    case "sealed":
      return "completed";
    case "failed":
      return "rejected";
    default:
      return "pending";
  }
}

/** Infer approximate severity bucket counts from the two fast counters
 *  maintained by the DB trigger. The detail page shows the full breakdown
 *  from `scan_logs`; the card view only needs enough signal for the bar. */
function inferSeverityCounts(
  findingCount: number,
  highSeverityCount: number,
): ScanCardData["findings"] {
  const total = Math.max(0, findingCount ?? 0);
  const high = Math.max(0, Math.min(highSeverityCount ?? 0, total));
  const rest = total - high;
  // Split rest roughly: 40% medium, 40% low, 20% info — close enough for
  // the mini-meter. Real numbers surface on the detail page.
  const medium = Math.floor(rest * 0.4);
  const low = Math.floor(rest * 0.4);
  const info = rest - medium - low;
  return {
    critical: 0,
    high,
    medium,
    low,
    info,
  };
}

/** Try to extract a human-readable host name from a URL; fall back to raw. */
function prettifyTargetUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

export function scanRowToCard(row: ScanRow): ScanCardData {
  return {
    id: row.id,
    target: prettifyTargetUrl(row.target_url),
    service: row.target_model,
    status: toCardStatus(row.status),
    startedAt: row.created_at,
    findings: inferSeverityCounts(row.finding_count, row.high_severity_count),
    href: `/dashboard/scans/${row.id}`,
  };
}

export function scansTableToCards(rows: ScanRow[]): ScanCardData[] {
  return rows.map(scanRowToCard);
}
