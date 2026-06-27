/**
 * lib/aegis/closed-loop.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — Aegis closed-loop remediation proof.
 *
 * `verifyRuleBlocksAttack` loads the exact attack payload that succeeded
 * (a scan_logs finding row) and the Aegis WAF rule generated for that
 * finding's technique, then runs the pure local proof in
 * `closed-loop-match.ts`. No live target is contacted; the proof is a
 * deterministic string/regex match of the rule against the payload body.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { techniqueForFinding, ruleBlocksPayload } from "@/lib/aegis/closed-loop-match";
import { autoPersistAegisRulesForScan } from "@/lib/evolve/aegis-auto-export";

export interface ClosedLoopResult {
  verified: boolean;
  ruleId?: string;
  afterBlocked: boolean;
  technique?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AegisRuleRow = {
  id: string;
  rule_id: string | null;
  pattern: string | null;
  rule_content: string | null;
  action: string | null;
  enabled: boolean | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScanLogRow = {
  id: string;
  scan_id: string;
  type: string;
  severity: string;
  attack_name: string | null;
  payload: unknown;
  created_at: string;
};

/**
 * Prove that the Aegis rule generated for a finding would block that finding's
 * exact attack payload.
 *
 * @param admin  Service-role Supabase client (bypasses RLS).
 * @param scanId The scan the finding belongs to.
 * @param findingId  The scan_logs row id of the successful attack.
 */
export async function verifyRuleBlocksAttack(
  admin: SupabaseClient,
  scanId: string,
  findingId: string,
): Promise<ClosedLoopResult> {
  // 1. Load the finding (the exact attack that succeeded) ----------------
  const { data: finding, error: findErr } = (await (admin as any)
    .from("scan_logs")
    .select("id, scan_id, type, severity, attack_name, payload, created_at")
    .eq("id", findingId)
    .maybeSingle()) as { data: ScanLogRow | null; error: { message: string } | null };

  if (findErr) return { verified: false, afterBlocked: false, error: findErr.message };
  if (!finding) return { verified: false, afterBlocked: false, error: "finding not found" };
  if (finding.scan_id !== scanId) {
    return { verified: false, afterBlocked: false, error: "finding does not belong to scan" };
  }

  const technique = techniqueForFinding(finding.attack_name);

  // 2. Ensure rules exist for the scan (auto-evolve if none yet) ----------
  const { count } = (await (admin as any)
    .from("aegis_rules")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scanId)) as { count: number | null };

  if (!count || count === 0) {
    await autoPersistAegisRulesForScan(admin, scanId, undefined);
  }

  // 3. Load the aegis_rule generated for this technique ------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules } = (await (admin as any)
    .from("aegis_rules")
    .select("id, rule_id, pattern, rule_content, action, enabled")
    .eq("scan_id", scanId)) as { data: AegisRuleRow[] | null };

  const rule = (rules ?? []).find(
    (r) => typeof r.rule_id === "string" && r.rule_id.includes(`fg-aegis-${technique}-`),
  );

  if (!rule) {
    return {
      verified: false,
      afterBlocked: false,
      technique,
      error: `no aegis_rule generated for technique "${technique}"`,
    };
  }

  // 4. Local deterministic proof -----------------------------------------
  const proof = ruleBlocksPayload(
    rule.pattern ?? "",
    rule.rule_content ?? null,
    finding.payload,
    finding.attack_name,
  );

  const verified = proof.afterBlocked;

  // 5. Persist the proof onto the rule -----------------------------------
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("aegis_rules")
      .update({ verified_blocks_attack: verified })
      .eq("id", rule.id);
  } catch {
    // Non-fatal — the proof is still returned to the caller.
  }

  return {
    verified,
    ruleId: rule.rule_id ?? undefined,
    afterBlocked: proof.afterBlocked,
    technique: proof.technique,
  };
}
