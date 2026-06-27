import { createServerSupabase } from "@/lib/supabase/server";
import type { AlmanacEntry } from "@/lib/almanac/types";

export interface AlmanacListFilters {
  q?: string;
  family?: string;
  owasp?: string;
  limit?: number;
}

export async function fetchPublishedAlmanacEntries(
  filters: AlmanacListFilters = {},
): Promise<AlmanacEntry[]> {
  const supabase = await createServerSupabase();
  const limit = Math.min(filters.limit ?? 100, 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("vulnerability_almanac_entries")
    .select(
      "id, slug, title, family, owasp_id, severity, summary_md, poc_redacted, attack_hash, first_seen_at, last_seen_at, source_scan_id, published, source_type, cve_id, merged_into_id, epss_score, epss_percentile, cvss_v3_score, cvss_severity, nvd_published",
    )
    .eq("published", true)
    .is("merged_into_id", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (filters.family?.trim()) {
    query = query.eq("family", filters.family.trim());
  }
  if (filters.owasp?.trim()) {
    query = query.eq("owasp_id", filters.owasp.trim().toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[almanac] list:", error.message);
    return [];
  }

  let rows = (data ?? []) as AlmanacEntry[];
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.family.toLowerCase().includes(q) ||
        (r.owasp_id ?? "").toLowerCase().includes(q) ||
        r.summary_md.toLowerCase().includes(q),
    );
  }
  return rows;
}

export async function fetchPublishedAlmanacBySlug(
  slug: string,
): Promise<AlmanacEntry | null> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("vulnerability_almanac_entries")
    .select(
      "id, slug, title, family, owasp_id, severity, summary_md, poc_redacted, attack_hash, first_seen_at, last_seen_at, source_scan_id, published, source_type, cve_id, merged_into_id, epss_score, epss_percentile, cvss_v3_score, cvss_severity, nvd_published",
    )
    .eq("slug", slug)
    .eq("published", true)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as AlmanacEntry;
}

export async function fetchAlmanacFacets(): Promise<{
  families: string[];
  owaspIds: string[];
}> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("vulnerability_almanac_entries")
    .select("family, owasp_id")
    .eq("published", true)
    .is("merged_into_id", null)
    .limit(500);

  const families = new Set<string>();
  const owaspIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.family) families.add(row.family);
    if (row.owasp_id) owaspIds.add(row.owasp_id);
  }
  return {
    families: [...families].sort(),
    owaspIds: [...owaspIds].sort(),
  };
}
