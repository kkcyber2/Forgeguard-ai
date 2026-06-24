"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { clearDistributedBlock } from "@/lib/perimeter/ip-blocklist";

export type ThreatConsoleStats = {
  events24h: number;
  critical24h: number;
  activeBlocks: number;
  honeypots24h: number;
};

export type PerimeterEventRow = {
  id: string;
  ip_hash: string;
  path: string | null;
  severity: string;
  geo_lat: number;
  geo_lng: number;
  geo_country: string | null;
  threat_delta: number | null;
  reason: string | null;
  source: string;
  created_at: string;
};

export type BlocklistRow = {
  id: string;
  ip_hash: string;
  reason: string;
  threat_score: number;
  expires_at: string;
  geo_country: string | null;
  created_at: string;
};

export async function fetchThreatConsoleStats(): Promise<ThreatConsoleStats> {
  await requireAdminProfile();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;

  const { count: events24h } = await admin
    .from("perimeter_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  const { count: critical24h } = await admin
    .from("perimeter_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("severity", "critical");

  const { count: honeypots24h } = await admin
    .from("perimeter_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .ilike("reason", "%honeypot%");

  const { count: activeBlocks } = await admin
    .from("perimeter_ip_blocklist")
    .select("id", { count: "exact", head: true })
    .gt("expires_at", new Date().toISOString());

  return {
    events24h: events24h ?? 0,
    critical24h: critical24h ?? 0,
    activeBlocks: activeBlocks ?? 0,
    honeypots24h: honeypots24h ?? 0,
  };
}

export async function fetchPerimeterEvents(): Promise<PerimeterEventRow[]> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;
  const { data, error } = await admin
    .from("perimeter_events")
    .select(
      "id, ip_hash, path, severity, geo_lat, geo_lng, geo_country, threat_delta, reason, source, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[threat-console] events:", error.message);
    return [];
  }
  return (data ?? []) as PerimeterEventRow[];
}

export async function fetchActiveBlocklist(): Promise<BlocklistRow[]> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;
  const { data, error } = await admin
    .from("perimeter_ip_blocklist")
    .select("id, ip_hash, reason, threat_score, expires_at, geo_country, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[threat-console] blocklist:", error.message);
    return [];
  }
  return (data ?? []) as BlocklistRow[];
}

export async function unblockIpHash(
  ipHash: string,
  blockId?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminSupabase() as any;

  const past = new Date(Date.now() - 1000).toISOString();
  let query = admin
    .from("perimeter_ip_blocklist")
    .update({ expires_at: past })
    .eq("ip_hash", ipHash)
    .gt("expires_at", new Date().toISOString());

  if (blockId) query = query.eq("id", blockId);

  const { error } = await query;
  if (error) return { ok: false, error: error.message };

  await clearDistributedBlock(ipHash);
  revalidatePath("/admin/threat-console");
  return { ok: true };
}
