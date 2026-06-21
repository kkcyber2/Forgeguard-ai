import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countFindingsFromReport,
  countFindingsFromScanLogs,
  type FindingCountResult,
} from "@/lib/scans/finding-counts";

type ScanListRow = {
  id: string;
  status: string;
  finding_count: number | null;
  high_severity_count: number | null;
};

/** When scans.finding_count is 0 on sealed rows, hydrate from report or breach logs. */
export async function enrichScanRowsWithReportCounts<
  T extends ScanListRow,
>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const stale = rows.filter(
    (r) =>
      r.status === "sealed" &&
      (r.finding_count ?? 0) === 0,
  );
  if (!stale.length) return rows;

  const ids = stale.map((r) => r.id);
  const { data: reports } = await supabase
    .from("scan_reports")
    .select("scan_id, findings")
    .in("scan_id", ids);

  const countByScan = new Map<string, FindingCountResult>();
  for (const rep of reports ?? []) {
    const findings = Array.isArray(rep.findings) ? rep.findings : [];
    if (findings.length === 0) continue;
    countByScan.set(rep.scan_id, countFindingsFromReport(findings));
  }

  const missingReportIds = ids.filter((id) => !countByScan.has(id));
  if (missingReportIds.length > 0) {
    const { data: logs } = await supabase
      .from("scan_logs")
      .select("scan_id, type, severity, attack_name, payload")
      .in("scan_id", missingReportIds)
      .in("type", ["breach", "strike"]);

    const logsByScan = new Map<string, typeof logs>();
    for (const row of logs ?? []) {
      const list = logsByScan.get(row.scan_id) ?? [];
      list.push(row);
      logsByScan.set(row.scan_id, list);
    }

    for (const scanId of missingReportIds) {
      const scanLogs = logsByScan.get(scanId) ?? [];
      if (scanLogs.length === 0) continue;
      const counts = countFindingsFromScanLogs(scanLogs);
      if (counts.finding_count > 0) countByScan.set(scanId, counts);
    }
  }

  return rows.map((row) => {
    const counts = countByScan.get(row.id);
    if (!counts) return row;
    return {
      ...row,
      finding_count: counts.finding_count,
      high_severity_count: counts.high_severity_count,
    };
  });
}
