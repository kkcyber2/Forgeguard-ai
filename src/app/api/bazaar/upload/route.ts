/**
 * POST /api/bazaar/upload
 * ─────────────────────────────────────────────────────────────────────────────
 * Hacker Bazaar — Script Upload + Sovereign Customs Agent (engine audit)
 *
 * Flow:
 *   1. Auth guard (access_level ≥ 2, or Sovereign operator)
 *   2. Validate payload → insert row (audit_verdict=pending)
 *   3. POST engine /bazaar/audit/{script_id} — DeepSeek-R1 customs judge
 *   4. Engine updates verdict, is_certified, metadata.remediation_advice
 *   5. REJECTED → 422 + Malicious Script Attempt logged on engine
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { triggerBazaarAudit } from "@/lib/bazaar/trigger-bazaar-audit";
import { syncBazaarAuditResult } from "@/lib/bazaar/sync-audit-result";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UploadSchema = z.object({
  name:        z.string().min(3).max(80),
  description: z.string().max(500).default(""),
  language:    z.enum(["python", "bash", "javascript", "rust"]).default("python"),
  tags:        z.array(z.string().max(30)).max(8).default([]),
  code:        z.string().min(10).max(50_000),
  price_usd:   z.number().min(0).max(9999).default(0),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle();

  const accessLevel = (profile?.access_level as number | undefined) ?? 1;
  const sovereign = isSovereignOperator(user.email);
  if (!sovereign && accessLevel < 2) {
    return NextResponse.json(
      { ok: false, error: "Rank 2+ required to list scripts.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  const { name, description, language, tags, code, price_usd } = parsed.data;

  const { data: script, error: insertErr } = await supabase
    .from("bazaar_scripts")
    .insert({
      author_id:         user.id,
      name,
      title:             name,
      description,
      language,
      tags,
      code,
      code_content:      code,
      price_usd,
      audit_verdict:     "pending",
      audit_risk_score:  0,
      is_published:      false,
      is_certified:      false,
      metadata:          { customs_agent: "sovereign", upload_phase: "pending_audit" },
    })
    .select("id, name")
    .single();

  if (insertErr || !script) {
    console.error("[bazaar/upload] insert error:", insertErr);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  const audit = await triggerBazaarAudit(script.id);

  try {
    await syncBazaarAuditResult(script.id, audit, price_usd);
  } catch (syncErr) {
    console.error("[bazaar/upload] audit sync error:", syncErr);
  }

  if (audit.verdict === "rejected") {
    return NextResponse.json(
      {
        ok:      false,
        error:   audit.reason || "Script rejected by Sovereign Customs Agent.",
        audit: {
          verdict: audit.verdict,
          risk_score: audit.risk_score,
          findings: audit.findings,
          reason: audit.reason,
          remediation_advice: audit.remediation_advice,
        },
        script_id: script.id,
        code:    "CUSTOMS_REJECTED",
      },
      { status: 422 },
    );
  }

  const qualityScore = Math.max(0, Math.min(10, Math.round((100 - audit.risk_score) / 10)));
  const isCertified =
    (audit.risk_score > 8 || qualityScore > 8) && audit.verdict === "cleared";

  return NextResponse.json({
    ok:           true,
    script_id:    script.id,
    name:         script.name,
    verdict:      audit.verdict,
    risk_score:   audit.risk_score,
    quality_score: qualityScore,
    findings:     audit.findings,
    reason:       audit.reason,
    remediation_advice: audit.remediation_advice,
    is_published: audit.is_published ?? (isCertified && audit.verdict === "cleared"),
    is_certified: audit.is_certified ?? isCertified,
    custom_price_usd: price_usd,
    metadata:     audit.metadata,
    audit: {
      verdict: audit.verdict,
      risk_score: audit.risk_score,
      findings: audit.findings,
      reason: audit.reason,
      remediation_advice: audit.remediation_advice,
    },
    message:
      audit.verdict === "cleared"
        ? "Script cleared by Sovereign Customs Agent and listed on the Bazaar."
        : "Script flagged — pending admin review before listing.",
  });
}
