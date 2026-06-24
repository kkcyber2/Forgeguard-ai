import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomToolRow {
  id: string;
  name: string;
  description: string | null;
  spec: Record<string, unknown>;
  created_at: string;
}

/**
 * Persist Brain-authored tools from scan_logs when engine insert used legacy columns.
 * Idempotent — skips if a tool with the same name already exists for the scan.
 */
export async function syncCustomToolsFromScanLogs(
  admin: SupabaseClient,
  scanId: string,
  userId: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs } = await (admin as any)
    .from("scan_logs")
    .select("id, type, attack_name, payload, created_at")
    .eq("scan_id", scanId)
    .in("type", ["tool_authored", "strike", "breach"])
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from("custom_tools")
    .select("name")
    .eq("origin_scan_id", scanId);

  const existingNames = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.toLowerCase()),
  );

  let inserted = 0;
  for (const log of logs ?? []) {
    const name = String(log.attack_name ?? "").trim();
    if (!name) continue;
    const payload = (log.payload ?? {}) as Record<string, unknown>;
    const isToolLog =
      String(log.type ?? "") === "tool_authored" ||
      name.toLowerCase().includes("custom_tool") ||
      Boolean(payload.purpose);
    if (!isToolLog) continue;
    if (existingNames.has(name.toLowerCase())) continue;

    const spec = {
      language: "python",
      purpose: payload.purpose ?? payload.message ?? "Brain-authored probe",
      network_allowed: payload.network ?? false,
      source_preview:
        typeof payload.source === "string"
          ? payload.source.slice(0, 500)
          : undefined,
      synced_from: "scan_logs",
      log_id: log.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("custom_tools").insert({
      user_id: userId,
      origin_scan_id: scanId,
      name,
      description: String(spec.purpose),
      spec,
      safety_status: "pending",
    });

    if (!error) {
      existingNames.add(name.toLowerCase());
      inserted += 1;
    }
  }

  return inserted;
}

export async function fetchCustomToolsForScan(
  admin: SupabaseClient,
  scanId: string,
): Promise<CustomToolRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("custom_tools")
    .select("id, name, description, spec, created_at")
    .eq("origin_scan_id", scanId)
    .order("created_at", { ascending: true });

  return (data ?? []) as CustomToolRow[];
}
