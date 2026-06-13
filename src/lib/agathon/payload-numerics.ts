/**
 * @module agathon/payload-numerics
 * Assassin engine → Supabase bridge. Normalizes webhook payloads from Railway
 * before upserting scan_reports (executive_summary_md, financial_liability_usd, etc.).
 *
 * Cast numeric values in log/finding payloads to strings for Supabase JSON safety.
 * Mirrors AI-red-team/agathon/supabase_sync.py stringify_payload_numerics.
 */

const VALID_RISK_LABELS = new Set([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

/** Map reporter/engine severities (e.g. INFO) to scan_reports.risk_label CHECK values. */
export function normalizeRiskLabel(raw: unknown): string {
  const upper = String(raw ?? "NONE")
    .trim()
    .toUpperCase();
  if (VALID_RISK_LABELS.has(upper)) return upper;
  if (upper === "INFO" || upper === "INFORMATIONAL") return "LOW";
  return "NONE";
}

/** scan_reports columns that must stay JSON numbers for Postgres NUMERIC/INTEGER. */
const SCAN_REPORT_NUMERIC_COLUMNS = new Set([
  "attacks_run",
  "cvss_overall",
  "ale_usd",
  "financial_liability_usd",
  "generation_cost_usd",
  "generation_input_tokens",
  "generation_output_tokens",
]);

export function stringifyPayloadNumerics(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stringifyPayloadNumerics(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyPayloadNumerics(item));
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "nan";
    return String(value);
  }
  return value;
}

/**
 * Upsert scan_reports from Agathon webhook — preserves numeric columns, fills Secure summary.
 */
export function prepareScanReportUpsert(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };

  out.risk_label = normalizeRiskLabel(out.risk_label);

  if (out.cvss_overall == null) {
    out.cvss_overall = 0;
  } else {
    const cvss =
      typeof out.cvss_overall === "number"
        ? out.cvss_overall
        : Number.parseFloat(String(out.cvss_overall));
    out.cvss_overall = Number.isNaN(cvss) ? 0 : Math.min(10, Math.max(0, cvss));
  }

  if (
    out.executive_summary_md == null ||
    String(out.executive_summary_md).trim() === ""
  ) {
    const attacksRun = Number(out.attacks_run ?? 0);
    const hasFindings =
      Array.isArray(out.findings) && out.findings.length > 0;
    if (!hasFindings && attacksRun > 0) {
      out.executive_summary_md = `Status: Secure. ${attacksRun} attack vectors tested. No exploitable vulnerabilities at current intensity.`;
    } else if (
      typeof out.technical_proof_of_concept === "string" &&
      out.technical_proof_of_concept.trim()
    ) {
      out.executive_summary_md = out.technical_proof_of_concept;
    } else {
      out.executive_summary_md = "Scan complete — no executive summary supplied.";
    }
  }

  if (out.findings == null) {
    out.findings = [];
  }
  if (Array.isArray(out.findings)) {
    out.findings = stringifyPayloadNumerics(out.findings);
  }
  if (out.owasp_coverage != null && typeof out.owasp_coverage === "object") {
    out.owasp_coverage = stringifyPayloadNumerics(out.owasp_coverage);
  }
  if (out.attack_path != null && typeof out.attack_path === "object") {
    out.attack_path = stringifyPayloadNumerics(out.attack_path);
  }
  for (const key of SCAN_REPORT_NUMERIC_COLUMNS) {
    const val = out[key];
    if (val === undefined || val === null) continue;
    const n = typeof val === "number" ? val : Number.parseFloat(String(val));
    if (!Number.isNaN(n)) {
      out[key] = key === "attacks_run" ? Math.round(n) : n;
    }
  }
  return out;
}
