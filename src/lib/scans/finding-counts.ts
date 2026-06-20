/**
 * Derive scans.finding_count / high_severity_count from report or log rows.
 * Used by webhook ingress and list-page enrichment when counters are stale.
 */

export type FindingCountResult = {
  finding_count: number;
  high_severity_count: number;
};

function normalizeSeverity(raw: unknown): string {
  return String(raw ?? "info").trim().toLowerCase();
}

function isExploitableFinding(
  severity: string,
  success: boolean,
): boolean {
  if (success) return true;
  return severity !== "info" && severity !== "low";
}

/** Count from scan_reports.findings JSON (reporter vulnerability shape). */
export function countFindingsFromReport(
  findings: unknown[],
): FindingCountResult {
  let finding_count = 0;
  let high_severity_count = 0;
  const seen = new Set<string>();

  for (const raw of findings) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const sev = normalizeSeverity(f.severity);
    const success = f.success === true;
    const key = `${String(f.attack ?? f.id ?? f.title ?? "")}:${sev}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (isExploitableFinding(sev, success)) finding_count += 1;
    if (sev === "high" || sev === "critical") high_severity_count += 1;
  }

  return { finding_count, high_severity_count };
}

type LogRow = {
  type?: string | null;
  severity?: string | null;
  attack_name?: string | null;
  payload?: unknown;
};

function payloadSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.success === true || p.verdict === true;
}

/** Fallback: aggregate breach/strike rows from scan_logs (matches findings-breakdown). */
export function countFindingsFromScanLogs(
  logs: LogRow[],
): FindingCountResult {
  let finding_count = 0;
  let high_severity_count = 0;

  for (const r of logs) {
    const sev = normalizeSeverity(r.severity);
    const type = String(r.type ?? "").toLowerCase();

    if (type === "finding" || type === "breach") {
      finding_count += 1;
      if (sev === "high" || sev === "critical") high_severity_count += 1;
      continue;
    }

    if (
      (type === "attempt" || type === "strike") &&
      (sev === "high" || sev === "critical") &&
      payloadSuccess(r.payload)
    ) {
      finding_count += 1;
      high_severity_count += 1;
    }
  }

  return { finding_count, high_severity_count };
}
