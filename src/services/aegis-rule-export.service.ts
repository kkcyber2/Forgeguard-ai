import "server-only";

import {
  attackStringToRegex,
  buildDefenseExport,
  type AegisDefenseExport,
} from "@/lib/aegis/attack-regex";
import { defaultAegisAppId, snippetToShieldPattern } from "@/lib/aegis/shield-rules";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Finding } from "@/app/dashboard/scans/[id]/findings-report-types";
import {
  attackStringForFinding,
  isSuccessfulBreach,
} from "@/app/dashboard/scans/[id]/findings-report-types";

export type ExportAegisRuleContext = {
  scanId: string;
  userId: string;
  findingId?: string;
  appId?: string;
  description?: string;
  attackString?: string;
};

export type ExportAegisRuleResult =
  | { ok: true; ruleId: string; appId: string; download: AegisDefenseExport }
  | { ok: false; status: number; error: string };

type ScanRow = { id: string; user_id: string; status: string };

function findingFromReport(
  findings: Finding[] | null | undefined,
  findingId?: string,
): Finding | null {
  if (!findings?.length || !findingId) return null;
  return findings.find((f) => f.id === findingId) ?? null;
}

/**
 * Export breach attack string → regex into aegis_rules (aegis firewall rules table).
 */
export async function exportAegisRule(
  ctx: ExportAegisRuleContext,
): Promise<ExportAegisRuleResult> {
  const admin = createAdminSupabase();

  const { data: scan, error: scanErr } = (await admin
    .from("scans")
    .select("id, user_id, status")
    .eq("id", ctx.scanId)
    .maybeSingle()) as { data: ScanRow | null; error: { message: string } | null };

  if (scanErr) {
    console.error("[aegis-export] scan lookup:", scanErr.message);
    return { ok: false, status: 500, error: "Scan lookup failed" };
  }
  if (!scan) {
    return { ok: false, status: 404, error: "Scan not found" };
  }
  if (scan.user_id !== ctx.userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const { data: report, error: reportErr } = await admin
    .from("scan_reports")
    .select("remediation_code_snippet, findings")
    .eq("scan_id", ctx.scanId)
    .maybeSingle();

  if (reportErr) {
    console.error("[aegis-export] report lookup:", reportErr.message);
    return { ok: false, status: 500, error: "Report lookup failed" };
  }

  const findings = (report?.findings as Finding[] | null) ?? [];
  const finding = findingFromReport(findings, ctx.findingId);

  if (finding && !isSuccessfulBreach(finding)) {
    return { ok: false, status: 422, error: "Finding is not a confirmed breach" };
  }

  const attackRaw =
    ctx.attackString?.trim() ||
    (finding ? attackStringForFinding(finding) : "");

  let shieldPattern = attackRaw ? attackStringToRegex(attackRaw) : "";

  if (!shieldPattern) {
    const ruleContent = String(report?.remediation_code_snippet ?? "").trim();
    shieldPattern = snippetToShieldPattern(ruleContent);
  }

  if (!shieldPattern) {
    return {
      ok: false,
      status: 422,
      error: "No attack string or remediation snippet to derive a rule",
    };
  }

  const appId = ctx.appId ?? defaultAegisAppId(ctx.userId);
  const findingSuffix = ctx.findingId?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "report";
  const ruleId = `fg-aegis-${findingSuffix}-${Date.now().toString(36)}`;
  const description =
    ctx.description?.trim() ||
    (finding
      ? `Breach block · ${finding.attack} · ${finding.family}`
      : `Scan ${ctx.scanId.slice(0, 8)} breach rule`);

  const ruleContent =
    String(report?.remediation_code_snippet ?? "").trim() ||
    `# ForgeGuard Aegis regex\npattern = r"${shieldPattern}"\n`;

  const download = buildDefenseExport({
    scanId: ctx.scanId,
    findingId: ctx.findingId ?? "scan",
    ruleId,
    description,
    pattern: shieldPattern,
  });

  const { error: insertErr } = await admin.from("aegis_rules").upsert(
    {
      scan_id: ctx.scanId,
      rule_id: ruleId,
      pattern: shieldPattern.slice(0, 500),
      rule_content: ruleContent.slice(0, 8000),
      description: description.slice(0, 500),
      action: "block",
      format: "cloudflare",
      enabled: true,
      app_id: appId,
      finding_id: ctx.findingId ?? null,
    },
    { onConflict: "rule_id" },
  );

  if (insertErr) {
    console.error("[aegis-export] insert:", insertErr.message);
    return { ok: false, status: 500, error: insertErr.message };
  }

  return { ok: true, ruleId, appId, download };
}
