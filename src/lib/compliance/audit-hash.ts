import { createHash } from "node:crypto";

/**
 * Pure hash primitive for the audit chain — no server-only, no Supabase,
 * so it is unit-testable in isolation.
 *
 * event_hash = sha256( prev_hash || "|" || event || "|" || scan_id || "|" || created_at )
 */
export function computeEventHash(
  prevHash: string | null,
  event: string,
  scanId: string,
  createdAtIso: string,
): string {
  const payload = `${prevHash ?? ""}|${event}|${scanId}|${createdAtIso}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
