import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { safeQueryRows } from "@/lib/supabase/safe-query";

type ServerSupabase = SupabaseClient<Database>;

type AleRow = { ale_usd: number | null };

/** Sum ALE ($) for a user from scan_reports only (live schema). */
export async function fetchTotalAleRisk(
  supabase: ServerSupabase,
  userId: string,
): Promise<number> {
  try {
    const { data: scanRows } = await safeQueryRows<{ id: string }>(
      "scans/ids",
      () =>
        supabase.from("scans").select("id").eq("user_id", userId),
    );

    const scanIds = scanRows.map((s) => s.id);
    if (scanIds.length === 0) return 0;

    const { data: reports } = await safeQueryRows<AleRow>(
      "scan_reports/ale_usd",
      () =>
        supabase.from("scan_reports").select("ale_usd").in("scan_id", scanIds),
    );

    return reports.reduce((sum, row) => sum + Number(row.ale_usd ?? 0), 0);
  } catch (err) {
    console.error("[scans/queries] fetchTotalAleRisk:", err);
    return 0;
  }
}

/** Columns that exist on live scan_reports (PostgREST-safe). */
export const SCAN_REPORT_SELECT =
  "executive_summary_md, cvss_overall, risk_label, findings, optimization_suggestions_md, owasp_coverage, generation_cost_usd, discovery_report, ale_usd, aegis_zip_b64";

export const SCAN_REPORT_SELECT_MINIMAL =
  "executive_summary_md, cvss_overall, risk_label, findings, optimization_suggestions_md, owasp_coverage, generation_cost_usd, discovery_report";

export type ScanRow = Pick<
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

export async function fetchRecentScans(
  supabase: ServerSupabase,
  userId: string,
  limit = 8,
): Promise<ScanRow[]> {
  try {
    const { data } = await safeQueryRows<ScanRow>(
      "scans/recent",
      () =>
        supabase
          .from("scans")
          .select(
            "id, target_model, target_url, status, progress_pct, finding_count, high_severity_count, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
    );
    return data;
  } catch (err) {
    console.error("[scans/queries] fetchRecentScans:", err);
    return [];
  }
}

/** Fetch scan report row — tries full select, falls back without ale_usd. */
export async function fetchScanReport(
  supabase: ServerSupabase,
  scanId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data: fullRows } = await safeQueryRows<Record<string, unknown>>(
      "scan_reports/full",
      () =>
        supabase
          .from("scan_reports")
          .select(SCAN_REPORT_SELECT)
          .eq("scan_id", scanId)
          .limit(1),
    );
    if (fullRows.length > 0) return fullRows[0] ?? null;

    const { data: minimalRows } = await safeQueryRows<Record<string, unknown>>(
      "scan_reports/minimal",
      () =>
        supabase
          .from("scan_reports")
          .select(SCAN_REPORT_SELECT_MINIMAL)
          .eq("scan_id", scanId)
          .limit(1),
    );
    return minimalRows[0] ?? null;
  } catch (err) {
    console.error("[scans/queries] fetchScanReport:", err);
    return null;
  }
}
