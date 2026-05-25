import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type ServerSupabase = SupabaseClient<Database>;

/** Sum ALE ($) for a user from scan_reports only (live schema). */
export async function fetchTotalAleRisk(
  supabase: ServerSupabase,
  userId: string,
): Promise<number> {
  try {
    const { data: scanRows, error: scanIdErr } = await supabase
      .from("scans")
      .select("id")
      .eq("user_id", userId);

    if (scanIdErr) {
      console.error("[scans/queries] scan ids:", scanIdErr.message);
      return 0;
    }

    const scanIds = (scanRows ?? []).map((s) => s.id);
    if (scanIds.length === 0) return 0;

    const { data: reports, error: reportErr } = await supabase
      .from("scan_reports")
      .select("ale_usd")
      .in("scan_id", scanIds);

    if (reportErr) {
      console.warn("[scans/queries] scan_reports ale_usd:", reportErr.message);
      return 0;
    }

    return (reports ?? []).reduce(
      (sum, row) => sum + Number(row.ale_usd ?? 0),
      0,
    );
  } catch (err) {
    console.error("[scans/queries] fetchTotalAleRisk:", err);
    return 0;
  }
}

/** Columns that exist on live scan_reports (PostgREST-safe). */
export const SCAN_REPORT_SELECT =
  "executive_summary_md, cvss_overall, risk_label, findings, optimization_suggestions_md, owasp_coverage, generation_cost_usd, discovery_report, ale_usd, aegis_zip_b64";

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
    const { data, error } = await supabase
      .from("scans")
      .select(
        "id, target_model, target_url, status, progress_pct, finding_count, high_severity_count, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[scans/queries] fetchRecentScans:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[scans/queries] fetchRecentScans:", err);
    return [];
  }
}
