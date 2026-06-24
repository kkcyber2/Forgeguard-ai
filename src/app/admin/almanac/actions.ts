"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { ingestCveAlmanacEntries } from "@/lib/almanac/cve-ingest";
import type { AlmanacEntry } from "@/lib/almanac/types";

export type AlmanacAdminStats = {
  total: number;
  published: number;
  draft: number;
  cve: number;
};

export async function fetchAlmanacAdminStats(): Promise<AlmanacAdminStats> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;

  const { count: total } = await admin
    .from("vulnerability_almanac_entries")
    .select("id", { count: "exact", head: true })
    .is("merged_into_id", null);

  const { count: published } = await admin
    .from("vulnerability_almanac_entries")
    .select("id", { count: "exact", head: true })
    .eq("published", true)
    .is("merged_into_id", null);

  const { count: cve } = await admin
    .from("vulnerability_almanac_entries")
    .select("id", { count: "exact", head: true })
    .eq("source_type", "cve")
    .is("merged_into_id", null);

  const t = total ?? 0;
  const p = published ?? 0;
  return { total: t, published: p, draft: t - p, cve: cve ?? 0 };
}

export async function fetchAlmanacAdminEntries(): Promise<AlmanacEntry[]> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;
  const { data, error } = await admin
    .from("vulnerability_almanac_entries")
    .select(
      "id, slug, title, family, owasp_id, severity, summary_md, poc_redacted, attack_hash, first_seen_at, last_seen_at, source_scan_id, published, source_type, cve_id, merged_into_id",
    )
    .is("merged_into_id", null)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[almanac:admin] list:", error.message);
    return [];
  }
  return (data ?? []) as AlmanacEntry[];
}

export async function setAlmanacPublished(
  id: string,
  published: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;
  const { error } = await admin
    .from("vulnerability_almanac_entries")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/almanac");
  revalidatePath("/resources/almanac");
  return { ok: true };
}

export async function mergeAlmanacEntries(
  keepId: string,
  mergeIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminProfile();
  const victims = mergeIds.filter((id) => id !== keepId);
  if (!keepId || victims.length === 0) {
    return { ok: false, error: "Select a keeper and at least one duplicate." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("vulnerability_almanac_entries")
    .update({
      merged_into_id: keepId,
      published: false,
      updated_at: now,
    })
    .in("id", victims);

  if (error) return { ok: false, error: error.message };

  await admin
    .from("vulnerability_almanac_entries")
    .update({ last_seen_at: now, updated_at: now })
    .eq("id", keepId);

  revalidatePath("/admin/almanac");
  revalidatePath("/resources/almanac");
  return { ok: true };
}

export async function runCveAlmanacIngest(): Promise<
  | { ok: true; scanned: number; inserted: number; updated: number }
  | { ok: false; error: string }
> {
  await requireAdminProfile();
  try {
    const admin = createAdminSupabase();
    const result = await ingestCveAlmanacEntries(admin);
    revalidatePath("/admin/almanac");
    return { ok: true, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "CVE ingest failed";
    return { ok: false, error: msg };
  }
}
