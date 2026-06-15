/**
 * Mirror Bazaar Customs audit fields when engine response must be persisted from gateway.
 * DeepSeek-R1 judge via POST /bazaar/audit/{script_id} on Railway.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { BazaarEngineAuditResult } from "@/lib/bazaar/trigger-bazaar-audit";

/** Cleared audit → ForgeGuard Certified + live on Bazaar. */
function resolveCertification(audit: BazaarEngineAuditResult): {
  isCertified: boolean;
  isPublished: boolean;
} {
  const passed =
    audit.verdict === "cleared" && audit.risk_score <= 25;
  return {
    isCertified: audit.is_certified ?? passed,
    isPublished: audit.is_published ?? passed,
  };
}

export async function syncBazaarAuditResult(
  scriptId: string,
  audit: BazaarEngineAuditResult,
  customPriceUsd: number,
): Promise<void> {
  const db = createAdminSupabase();
  const qualityScore = Math.max(0, Math.min(10, Math.round((100 - audit.risk_score) / 10)));
  const { isCertified, isPublished } = resolveCertification(audit);

  const metadata = {
    ...(audit.metadata ?? {}),
    customs_agent: "sovereign",
    judge_model: "deepseek/deepseek-r1",
    quality_score: qualityScore,
    custom_price_usd: customPriceUsd,
    remediation_advice: audit.remediation_advice,
  };

  await db
    .from("bazaar_scripts")
    .update({
      audit_verdict: audit.verdict,
      audit_risk_score: audit.risk_score,
      audit_findings: audit.findings,
      audit_reason: audit.reason,
      audited_at: new Date().toISOString(),
      is_certified: isCertified,
      is_published: isPublished,
      price_usd: customPriceUsd,
      metadata,
    })
    .eq("id", scriptId);
}
