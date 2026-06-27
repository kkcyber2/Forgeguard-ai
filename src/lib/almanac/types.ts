export type AlmanacSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type AlmanacSourceType = "scan" | "cve" | "nvd";

export interface AlmanacEntry {
  id: string;
  slug: string;
  title: string;
  family: string;
  owasp_id: string | null;
  severity: AlmanacSeverity;
  summary_md: string;
  poc_redacted: string | null;
  attack_hash: string;
  first_seen_at: string;
  last_seen_at: string;
  source_scan_id: string | null;
  published: boolean;
  source_type: AlmanacSourceType;
  cve_id: string | null;
  merged_into_id: string | null;
  epss_score: number | null;
  epss_percentile: number | null;
  cvss_v3_score: number | null;
  cvss_severity: string | null;
  nvd_published: string | null;
}

export const OWASP_LLM_IDS = [
  "LLM01",
  "LLM02",
  "LLM03",
  "LLM04",
  "LLM05",
  "LLM06",
  "LLM07",
  "LLM08",
  "LLM09",
  "LLM10",
] as const;
