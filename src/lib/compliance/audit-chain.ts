import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeEventHash } from "./audit-hash";

/**
 * Immutable, hash-chained audit trail for scans.
 * ----------------------------------------------
 *
 * Each scan_audit_events row stores:
 *   event_hash = sha256( prev_hash || "|" || event || "|" || scan_id || "|" || created_at )
 *
 * `prev_hash` is the previous row's event_hash (null for the first row).
 * Because UPDATE/DELETE are revoked from `authenticated` and inserts only
 * happen via the service role, the chain is tamper-evident: any in-place
 * edit breaks the hash link, which verifyAuditChain detects.
 *
 * `created_at` is generated client-side (not DB-default) so the hash can be
 * computed before insert and recomputed exactly on verify.
 */

export type AuditEventName =
  | "scope_verified"
  | "scan_started"
  | "first_finding"
  | "scan_sealed";

export interface AuditEventRow {
  id: string;
  scan_id: string;
  user_id: string;
  event: string;
  policy_version: string | null;
  event_hash: string;
  prev_hash: string | null;
  created_at: string;
}

interface AppendParams {
  scanId: string;
  userId: string;
  event: AuditEventName | string;
  policyVersion?: string | null;
}

/**
 * Append a chained event and return the new event_hash.
 *
 * Fetches the latest event_hash for the scan (ordered by created_at desc),
 * computes the new hash, and inserts. Concurrency note: two simultaneous
 * appends could race on prev_hash — callers append from single-writer
 * lifecycle hooks (scan create / webhook) so this is not a concern in
 * practice.
 */
export async function appendAuditEvent(
  admin: SupabaseClient,
  { scanId, userId, event, policyVersion = null }: AppendParams,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = (await (admin as any)
    .from("scan_audit_events")
    .select("event_hash, created_at")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { event_hash: string | null } | null };

  const prevHash = latest?.event_hash ?? null;
  const createdAtIso = new Date().toISOString();
  const eventHash = computeEventHash(prevHash, event, scanId, createdAtIso);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = (await (admin as any).from("scan_audit_events").insert({
    scan_id: scanId,
    user_id: userId,
    event,
    policy_version: policyVersion,
    event_hash: eventHash,
    prev_hash: prevHash,
    created_at: createdAtIso,
  })) as { error: { message: string } | null };

  if (error) {
    throw new Error(`audit chain insert failed: ${error.message}`);
  }
  return eventHash;
}

/**
 * Append an event only if no row with the same `event` name already exists
 * for this scan. Used for lifecycle milestones (scan_started, first_finding)
 * that should appear exactly once in the chain even if the webhook fires
 * multiple times. Returns the new hash, or null if the event was already
 * present.
 */
export async function appendAuditEventOnce(
  admin: SupabaseClient,
  params: AppendParams,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = (await (admin as any)
    .from("scan_audit_events")
    .select("id")
    .eq("scan_id", params.scanId)
    .eq("event", params.event)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };
  if (existing) return null;
  return appendAuditEvent(admin, params);
}

export interface AuditChainVerification {
  valid: boolean;
  brokenAt: number | null; // 1-based index of the first mismatched event
  length: number;
}

/**
 * Recompute every hash from the oldest event forward and compare to the
 * stored event_hash. Returns valid=false at the first mismatch.
 */
export async function verifyAuditChain(
  admin: SupabaseClient,
  scanId: string,
): Promise<AuditChainVerification> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (admin as any)
    .from("scan_audit_events")
    .select("id, event, event_hash, prev_hash, created_at")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true })) as {
    data: AuditEventRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`audit chain read failed: ${error.message}`);
  }
  const rows = data ?? [];
  let prevHash: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // The stored prev_hash must equal the previously computed hash.
    if ((row.prev_hash ?? null) !== (prevHash ?? null)) {
      return { valid: false, brokenAt: i + 1, length: rows.length };
    }
    const expected = computeEventHash(
      prevHash,
      row.event,
      scanId,
      row.created_at,
    );
    if (expected !== row.event_hash) {
      return { valid: false, brokenAt: i + 1, length: rows.length };
    }
    prevHash = row.event_hash;
  }

  return { valid: true, brokenAt: null, length: rows.length };
}
