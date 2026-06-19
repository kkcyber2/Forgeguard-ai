/** Shared scan report types — safe for Server Components (no "use client"). */

export interface PoC {
  curl?: string;
  python?: string;
}

export interface Finding {
  id: string;
  attack: string;
  family: string;
  level?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cvss: number;
  exploitability?: number;
  impact?: number;
  reliability?: number;
  evidence?: string;
  rationale?: string;
  summary?: string;
  verdict?: boolean;
  cwe_references?: string[];
  remediation?: string;
  proof_of_concept?: PoC;
  remediation_snippet_key?: string;
  observed_at?: string;
  ale_usd?: number | null;
  financial_liability_usd?: number | null;
  attack_prompt?: string;
}

export interface OWASPBucket {
  families: string[];
  max_cvss: number;
  count: number;
}

export interface ScanReport {
  executive_summary_md?: string;
  executive_summary?: string | null;
  audit_report_md?: string;
  cvss_overall?: number;
  risk_label?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings?: Finding[];
  attack_path?: unknown[] | null;
  optimization_suggestions_md?: string;
  owasp_coverage?: Record<string, OWASPBucket>;
  attacks_run?: number;
  wall_seconds?: number;
  generation_cost_usd?: number;
  discovery_report?: Record<string, unknown> | null;
  ale_usd?: number | null;
  financial_liability_usd?: number | null;
  technical_proof_of_concept?: string | null;
  remediation_code_snippet?: string | null;
  social_templates?: Record<string, unknown>[] | null;
  aegis_zip_b64?: string | null;
}

export function isSuccessfulBreach(finding: Finding): boolean {
  if (finding.verdict === true) return true;
  if (finding.severity === "critical" || finding.severity === "high") {
    return Boolean(finding.evidence?.trim() || finding.summary?.trim());
  }
  return false;
}

export function attackStringForFinding(finding: Finding): string {
  return (
    finding.attack_prompt?.trim() ||
    finding.attack?.trim() ||
    finding.evidence?.trim() ||
    finding.summary?.trim() ||
    ""
  );
}
