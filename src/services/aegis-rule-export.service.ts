import "server-only";

import { defaultAegisAppId, snippetToShieldPattern } from "@/lib/aegis/shield-rules";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type ExportAegisRuleContext = {
  scanId: string;
  userId: string;
  findingId?: string;
  appId?: string;
  description?: string;
};

export type ExportAegisRuleResult =
  | { ok: true; ruleId: string; appId: string }
  | { ok: false; status: number; error: string };

type ScanRow = { id: string; user_id: string; status: string };

/**
 * Export remediation_code_snippet from scan_reports into aegis_rules.
 * Uses admin client for insert (RLS bypass) — mirrors scan-launcher.service.ts.
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
    .select("remediation_code_snippet")
    .eq("scan_id", ctx.scanId)
    .maybeSingle();

  if (reportErr) {
    console.error("[aegis-export] report lookup:", reportErr.message);
    return { ok: false, status: 500, error: "Report lookup failed" };
  }

  const ruleContent = String(report?.remediation_code_snippet ?? "").trim();
  if (!ruleContent) {
    return {
      ok: false,
      status: 422,
      error: "No remediation_code_snippet on this scan report",
    };
  }

  const shieldPattern = snippetToShieldPattern(ruleContent);
  if (!shieldPattern) {
    return { ok: false, status: 422, error: "Could not derive shield pattern" };
  }

  const appId = ctx.appId ?? defaultAegisAppId(ctx.userId);
  const findingSuffix = ctx.findingId?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "report";
  const ruleId = `fg-aegis-${findingSuffix}-${Date.now().toString(36)}`;
  const description =
    ctx.description?.trim() ||
    (ctx.findingId
      ? `Finding ${ctx.findingId} · scan ${ctx.scanId.slice(0, 8)}`
      : `Scan ${ctx.scanId.slice(0, 8)} remediation export`);

  const { error: insertErr } = await admin.from("aegis_rules").upsert(
    {
      scan_id: ctx.scanId,
      rule_id: ruleId,
      pattern: shieldPattern.slice(0, 500),
      rule_content: ruleContent.slice(0, 8000),
      description: description.slice(0, 500),
      action: "block",
      format: "python",
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

  return { ok: true, ruleId, appId };
}
