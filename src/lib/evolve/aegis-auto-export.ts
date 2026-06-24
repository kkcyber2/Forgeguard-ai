import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aegisRulesToRows,
  buildCloudflareRuleset,
  type ScanFinding,
} from "@/lib/aegis/ruleset-core";
import { defaultAegisAppId } from "@/lib/aegis/shield-rules";

export interface AegisAutoExportResult {
  ok: boolean;
  ruleCount: number;
  error?: string;
}

/**
 * Best-effort: derive WAF rules from scan_logs and persist to aegis_rules.
 * Called from scan.completed webhook after corpus ingestion.
 */
export async function autoPersistAegisRulesForScan(
  admin: SupabaseClient,
  scanId: string,
  userId?: string,
): Promise<AegisAutoExportResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: findings, error: fetchErr } = await (admin as any)
      .from("scan_logs")
      .select("id, type, severity, attack_name, payload, created_at")
      .eq("scan_id", scanId)
      .in("type", ["finding", "attempt", "breach", "strike"])
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchErr) {
      return { ok: false, ruleCount: 0, error: fetchErr.message };
    }

    const effective: ScanFinding[] =
      (findings as ScanFinding[] | null)?.length
        ? (findings as ScanFinding[])
        : [
            {
              id: 0,
              type: "finding",
              severity: "medium",
              attack_name: "prompt_injection",
              payload: null,
              created_at: new Date().toISOString(),
            },
          ];

    const ruleset = buildCloudflareRuleset(scanId, effective);
    const appId = userId ? defaultAegisAppId(userId) : undefined;
    const rows = aegisRulesToRows(scanId, ruleset, { appId });

    if (rows.length === 0) {
      return { ok: true, ruleCount: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (admin as any)
      .from("aegis_rules")
      .upsert(rows, { onConflict: "rule_id" });

    if (upsertErr) {
      return { ok: false, ruleCount: 0, error: upsertErr.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("scan_logs").insert({
      scan_id: scanId,
      type: "info",
      severity: "info",
      attack_name: "aegis_auto_evolve",
      payload: {
        message: "Aegis rules auto-persisted from scan findings",
        rule_count: rows.length,
      },
    });

    return { ok: true, ruleCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aegis-auto-export]", scanId, msg);
    return { ok: false, ruleCount: 0, error: msg };
  }
}
