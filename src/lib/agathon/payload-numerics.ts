/**
 * Cast numeric values in log/finding payloads to strings for Supabase JSON safety.
 * Mirrors AI-red-team/agathon/supabase_sync.py stringify_payload_numerics.
 */

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
 * Stringify numerics inside findings JSON only — preserve top-level DB numeric columns.
 */
export function prepareScanReportUpsert(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
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
    if (!Number.isNaN(n)) out[key] = n;
  }
  return out;
}
