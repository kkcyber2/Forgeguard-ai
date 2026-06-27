import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAttackHash } from "@/lib/almanac/ingest";
import { redactSecrets } from "@/lib/security/redact-secrets";

/**
 * Phase 5 — NVD CVE 2.0 ingest (no API key).
 * -----------------------------------------------
 * NVD's public endpoint allows ~5 requests / 30s without a key, so we
 * run a small bounded set of AI/LLM keyword searches with a throttle
 * delay between calls. Each CVE is deduped into the Almanac by
 * (family, attack_hash) and carries its CVSS v3.1 base score/severity
 * and NVD publication date.
 *
 * See CITADEL_LAUNCH_VAULT/INTEL_VAULT_SCOPE.md — public data only.
 */

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const THROTTLE_MS = 6_500; // stay under the 5 req / 30s anonymous limit
const RESULTS_PER_PAGE = 40;

const AI_KEYWORDS = [
  "LLM",
  "large language model",
  "prompt injection",
  "OpenAI",
  "ChatGPT",
  "generative AI",
  "machine learning",
  "artificial intelligence",
];

interface NvdCve {
  id?: string;
  published?: string;
  descriptions?: Array<{ lang: string; value: string }>;
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData?: { baseScore?: number; baseSeverity?: string };
    }>;
    cvssMetricV30?: Array<{
      cvssData?: { baseScore?: number; baseSeverity?: string };
    }>;
  };
}

interface NvdResponse {
  vulnerabilities?: Array<{ cve?: NvdCve }>;
  totalResults?: number;
}

function slugifyCve(cveId: string): string {
  return cveId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function pickDescription(cve: NvdCve): string {
  const en = cve.descriptions?.find((d) => d.lang === "en");
  return en?.value ?? cve.descriptions?.[0]?.value ?? "";
}

function pickCvss(cve: NvdCve): {
  score: number | null;
  severity: string | null;
} {
  const m = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0];
  const score = m?.cvssData?.baseScore ?? null;
  const severity = m?.cvssData?.baseSeverity ?? null;
  return { score, severity };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchNvdKeyword(
  keyword: string,
): Promise<NvdCve[]> {
  const url = `${NVD_BASE}?keywordSearch=${encodeURIComponent(
    keyword,
  )}&resultsPerPage=${RESULTS_PER_PAGE}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[nvd] keyword "${keyword}" → HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as NvdResponse;
    return (json.vulnerabilities ?? [])
      .map((v) => v.cve)
      .filter((c): c is NvdCve => !!c && !!c.id);
  } catch (e) {
    console.warn(`[nvd] keyword "${keyword}" failed:`, (e as Error).message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Read-only ingest of public NVD CVEs matching AI/LLM keywords. */
export async function ingestNvdAlmanacEntries(
  admin: SupabaseClient,
): Promise<{ scanned: number; inserted: number; updated: number; errors: number }> {
  const seen = new Set<string>();
  const all: NvdCve[] = [];

  for (let i = 0; i < AI_KEYWORDS.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS);
    const rows = await fetchNvdKeyword(AI_KEYWORDS[i]!);
    for (const c of rows) {
      if (c.id && !seen.has(c.id)) {
        seen.add(c.id);
        all.push(c);
      }
    }
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const cve of all) {
    const cveId = cve.id!.trim();
    const family = "nvd";
    const attack_hash = computeAttackHash(family, cveId);
    const desc = pickDescription(cve);
    const { score, severity } = pickCvss(cve);

    const title = redactSecrets(cveId).slice(0, 200);
    const summary_md = redactSecrets(
      [
        `**External CVE reference** (NVD). Not ForgeGuard scan telemetry.`,
        ``,
        desc.slice(0, 3800),
      ].join("\n"),
    ).slice(0, 4000);

    const nvdPublished = cve.published ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from("vulnerability_almanac_entries")
      .select("id")
      .eq("family", family)
      .eq("attack_hash", attack_hash)
      .maybeSingle();

    if (existing?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from("vulnerability_almanac_entries")
        .update({
          last_seen_at: now,
          updated_at: now,
          cvss_v3_score: score,
          cvss_severity: severity,
          nvd_published: nvdPublished,
        })
        .eq("id", existing.id);
      if (error) errors += 1;
      else updated += 1;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("vulnerability_almanac_entries")
      .insert({
        slug: `${slugifyCve(cveId)}-nvd`,
        title,
        family,
        owasp_id: null,
        severity: severity ? severity.toLowerCase() : "high",
        summary_md,
        poc_redacted: null,
        attack_hash,
        first_seen_at: nvdPublished ?? now,
        last_seen_at: now,
        source_scan_id: null,
        published: false,
        source_type: "nvd",
        cve_id: cveId,
        cvss_v3_score: score,
        cvss_severity: severity,
        nvd_published: nvdPublished,
      });

    if (error) {
      if (error.code === "23505") updated += 1;
      else errors += 1;
    } else {
      inserted += 1;
    }
  }

  return { scanned: all.length, inserted, updated, errors };
}
