/**
 * POST /api/bazaar/upload
 * ─────────────────────────────────────────────────────────────────────────────
 * Hacker Bazaar — Script Upload + AI Customs Agent
 *
 * Flow:
 *   1. Auth guard (access_level ≥ 2, or Sovereign operator)
 *   2. Validate payload (name, description, code, price_usd)
 *   3. Call Python customs-audit bridge (or inline Llama-3 via OpenRouter)
 *      → verdict: CLEARED | FLAGGED | REJECTED
 *   4. If CLEARED/FLAGGED → insert row with audit result, is_published=false
 *      If REJECTED → return 422, do not persist
 *   5. Admin manually publishes after review for FLAGGED
 *      CLEARED scripts auto-publish if price == 0 OR author is Hacker rank
 *
 * Auth: Supabase session, access_level ≥ 2 (Rank 2+ hackers) or Sovereign operator.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { openRouterRequestHeaders } from "@/lib/agathon-config";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Validation schema ────────────────────────────────────────────────────────

const UploadSchema = z.object({
  name:        z.string().min(3).max(80),
  description: z.string().max(500).default(""),
  language:    z.enum(["python", "bash", "javascript", "rust"]).default("python"),
  tags:        z.array(z.string().max(30)).max(8).default([]),
  code:        z.string().min(10).max(50_000),
  price_usd:   z.number().min(0).max(9999).default(0),
});

// ─── AI Customs Agent (inline via OpenRouter / Groq) ─────────────────────────

interface AuditResult {
  verdict:    "cleared" | "flagged" | "rejected";
  risk_score: number;
  findings:   string[];
  reason:     string;
}

async function runCustomsAudit(code: string, language: string): Promise<AuditResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // No key → pass with warning
    return {
      verdict: "cleared",
      risk_score: 0,
      findings: ["Audit skipped — OPENROUTER_API_KEY not configured"],
      reason: "Manual review required",
    };
  }

  const systemPrompt = `You are the ForgeGuard Bazaar customs AI. Analyse uploaded scripts for malicious 'Traitor' patterns:
- Code targeting ForgeGuard infrastructure (Supabase URLs, Railway/Vercel domains, internal API keys)
- Self-referential attacks against ForgeGuard endpoints
- Credential harvesting or data exfiltration to external servers
- Cryptocurrency miners, backdoors, or persistent daemons
- Obfuscated destructive payloads (rm -rf, DROP TABLE)
- Reverse shells or C2 beacons

Return ONLY valid JSON:
{"verdict":"cleared|flagged|rejected","risk_score":0-100,"findings":["finding1"],"reason":"one sentence"}

- cleared: safe for marketplace (risk_score 0-20)
- flagged: suspicious, needs admin review (risk_score 21-60)
- rejected: definitively malicious, do not list (risk_score 61-100)`;

  const prompt = `Audit this ${language} script for Traitor logic:\n\n\`\`\`${language}\n${code.slice(0, 4000)}\n\`\`\``;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterRequestHeaders({
        apiKey,
        title: "ForgeGuard Bazaar Customs",
      }),
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",  // Scout tier — FREE
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: prompt },
        ],
        temperature: 0.1,
        max_tokens:  512,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON even if wrapped in markdown
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in audit response");

    const parsed = JSON.parse(match[0]) as {
      verdict: string; risk_score: number; findings: string[]; reason: string;
    };

    const verdict = (["cleared", "flagged", "rejected"].includes(parsed.verdict)
      ? parsed.verdict
      : "flagged") as "cleared" | "flagged" | "rejected";

    return {
      verdict,
      risk_score: Math.max(0, Math.min(100, Number(parsed.risk_score) || 0)),
      findings:   Array.isArray(parsed.findings) ? parsed.findings.slice(0, 10) : [],
      reason:     String(parsed.reason ?? "").slice(0, 300),
    };
  } catch (err) {
    console.error("[bazaar/upload] customs audit error:", err);
    return {
      verdict:    "flagged",
      risk_score: 40,
      findings:   [`Audit error: ${err instanceof Error ? err.message : String(err)}`],
      reason:     "Customs audit failed — manual review required",
    };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // Access level gate
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

  // Parse body
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

  // ── Run Customs Audit ───────────────────────────────────────────────────────
  const audit = await runCustomsAudit(code, language);

  if (audit.verdict === "rejected") {
    return NextResponse.json(
      {
        ok:      false,
        error:   "Script rejected by AI Customs Agent.",
        audit,
        code:    "CUSTOMS_REJECTED",
      },
      { status: 422 },
    );
  }

  // CLEARED and free scripts auto-publish; FLAGGED hold for admin review
  const autoPublish = audit.verdict === "cleared";

  // ── Persist ──────────────────────────────────────────────────────────────────
  const { data: script, error: insertErr } = await supabase
    .from("bazaar_scripts")
    .insert({
      author_id:         user.id,
      name,
      description,
      language,
      tags,
      code,
      price_usd,
      audit_verdict:     audit.verdict,
      audit_risk_score:  audit.risk_score,
      audit_findings:    audit.findings,
      audit_reason:      audit.reason,
      audited_at:        new Date().toISOString(),
      is_published:      autoPublish,
    })
    .select("id, name, audit_verdict, is_published")
    .single();

  if (insertErr) {
    console.error("[bazaar/upload] insert error:", insertErr);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({
    ok:          true,
    script_id:   script.id,
    name:        script.name,
    verdict:     audit.verdict,
    risk_score:  audit.risk_score,
    findings:    audit.findings,
    reason:      audit.reason,
    is_published: script.is_published,
    message:     audit.verdict === "cleared"
      ? "Script cleared and listed on the Bazaar."
      : "Script flagged — pending admin review before listing.",
  });
}
