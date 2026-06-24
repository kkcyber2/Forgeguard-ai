import type { SupabaseClient } from "@supabase/supabase-js";
import { redactSecrets } from "@/lib/security/redact-secrets";
import type { AlmanacSeverity } from "@/lib/almanac/types";

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function normalizeSeverity(raw: unknown): AlmanacSeverity {
  const s = String(raw ?? "medium").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low" || s === "info") {
    return s;
  }
  return "medium";
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "finding";
}

export function computeAttackHash(family: string, attackKey: string): string {
  const norm = `${family.trim().toLowerCase()}|${attackKey.trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < norm.length; i++) {
    h = (h * 31 + norm.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function redactText(value: unknown, maxLen = 4000): string {
  const text = redactSecrets(String(value ?? "")).trim();
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function inferOwaspId(finding: Record<string, unknown>): string | null {
  const direct =
    finding.owasp_llm ??
    finding.owasp_id ??
    finding.owasp ??
    finding.owasp_category;
  if (typeof direct === "string" && direct.trim()) {
    const m = direct.trim().toUpperCase().match(/LLM\d{2}/);
    return m ? m[0] : direct.trim().slice(0, 32);
  }
  return null;
}

function shouldIngestFinding(finding: Record<string, unknown>): boolean {
  const severity = normalizeSeverity(finding.severity);
  if (severity === "info") return false;
  const evidence = redactText(finding.evidence ?? finding.summary ?? "", 200);
  const attack =
    finding.attack ??
    finding.attack_name ??
    finding.title ??
    finding.attack_prompt;
  return Boolean(String(attack ?? "").trim() || evidence);
}

function buildAlmanacRow(
  finding: Record<string, unknown>,
  scanId: string,
): {
  slug: string;
  title: string;
  family: string;
  owasp_id: string | null;
  severity: AlmanacSeverity;
  summary_md: string;
  poc_redacted: string | null;
  attack_hash: string;
  source_scan_id: string;
} | null {
  if (!shouldIngestFinding(finding)) return null;

  const family = String(
    finding.family ?? finding.attack ?? finding.attack_name ?? "unknown",
  )
    .trim()
    .slice(0, 120);
  const attackKey = String(
    finding.attack ??
      finding.attack_name ??
      finding.attack_prompt ??
      finding.title ??
      family,
  ).trim();

  const attack_hash = computeAttackHash(family, attackKey);
  const title = redactSecrets(
    String(finding.title ?? finding.attack ?? family).trim(),
  ).slice(0, 200);

  const summaryParts = [
    finding.summary,
    finding.description,
    finding.rationale,
  ]
    .map((p) => redactText(p, 1200))
    .filter(Boolean);

  const summary_md =
    summaryParts.join("\n\n") ||
    `Observed **${family}** class weakness during automated red-team evaluation.`;

  const pocParts = [
    finding.attack_prompt,
    finding.evidence,
    finding.reproduction_steps,
  ]
    .map((p) => redactText(p, 2000))
    .filter(Boolean);

  const poc_redacted = pocParts.length ? pocParts.join("\n\n---\n\n") : null;
  const slugBase = slugify(`${family}-${attackKey}`);
  const slug = `${slugBase}-${attack_hash.slice(0, 6)}`;

  return {
    slug,
    title: title || family,
    family,
    owasp_id: inferOwaspId(finding),
    severity: normalizeSeverity(finding.severity),
    summary_md,
    poc_redacted,
    attack_hash,
    source_scan_id: scanId,
  };
}

function pickHigherSeverity(a: AlmanacSeverity, b: AlmanacSeverity): AlmanacSeverity {
  return (SEVERITY_RANK[a] ?? 0) >= (SEVERITY_RANK[b] ?? 0) ? a : b;
}

/** Ingest sanitized scan findings into the almanac (dedupe by family + attack_hash). */
export async function ingestScanFindingsToAlmanac(
  admin: SupabaseClient,
  params: { scanId: string; findings: unknown[] },
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const raw of params.findings) {
    if (!raw || typeof raw !== "object") continue;
    const row = buildAlmanacRow(raw as Record<string, unknown>, params.scanId);
    if (!row) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from("vulnerability_almanac_entries")
      .select("id, severity, slug")
      .eq("family", row.family)
      .eq("attack_hash", row.attack_hash)
      .maybeSingle();

    if (existing?.id) {
      const nextSeverity = pickHigherSeverity(
        row.severity,
        normalizeSeverity(existing.severity),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from("vulnerability_almanac_entries")
        .update({
          last_seen_at: now,
          updated_at: now,
          severity: nextSeverity,
          source_scan_id: row.source_scan_id,
        })
        .eq("id", existing.id);
      if (!error) updated += 1;
      else console.warn("[almanac] bump failed:", error.message);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("vulnerability_almanac_entries")
      .insert({
        ...row,
        published: false,
        source_type: "scan",
        first_seen_at: now,
        last_seen_at: now,
      });

    if (error) {
      if (error.code === "23505") {
        updated += 1;
      } else {
        console.warn("[almanac] insert failed:", error.message);
      }
    } else {
      inserted += 1;
    }
  }

  return { inserted, updated };
}
