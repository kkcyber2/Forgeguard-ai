/**
 * POST /api/bounty/triage
 * ─────────────────────────────────────────────────────────────────────────────
 * Bounty Vault — Automated CVSS 4.0 Triage Engine
 *
 * Accepts a vulnerability report (title, description, reproduction steps,
 * impact, affected component) and uses DeepSeek-R1 via OpenRouter to
 * produce a structured CVSS 4.0 analysis with auto-scored severity.
 *
 * The report is also compared against the caller's Aegis rule set to
 * determine whether an existing defence would have blocked the finding.
 *
 * Returns:
 *   { cvss_vector, cvss_score, severity, rationale, aegis_coverage }
 *
 * Auth: active Supabase session (all identity tiers may submit bounties)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schema ──────────────────────────────────────────────────────────────────

const TriageSchema = z.object({
  title:             z.string().min(1).max(200),
  description:       z.string().min(10).max(5000),
  reproduction:      z.string().max(3000).optional().default(""),
  impact:            z.string().max(2000).optional().default(""),
  affected_component:z.string().max(200).optional().default("LLM endpoint"),
  /** Sprint 10: domain that must be verified in target_verifications before submission. */
  target_domain:     z.string().max(253).optional(),
  /** Optional: scan_id to cross-reference existing Aegis rules for this target */
  scan_id:           z.string().uuid().optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CvssResult {
  cvss_vector:    string;     // e.g. "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N"
  cvss_score:     number;     // 0.0–10.0
  severity:       "none" | "low" | "medium" | "high" | "critical";
  rationale:      string;     // 1-2 sentence justification
  attack_vector:  string;
  attack_complexity: string;
  privileges_required: string;
  user_interaction: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  aegis_coverage: AegisCoverage;
}

export interface AegisCoverage {
  covered:         boolean;
  matching_rules:  string[];
  recommendation:  string;
}

// ─── CVSS 4.0 scoring table ──────────────────────────────────────────────────
// Simplified heuristic scoring when OpenRouter is unavailable.
// Full CVSS 4.0 lookup-table scoring requires 2^8 combinations —
// this covers the most common AI/LLM attack patterns.

const AI_ATTACK_CVSS_MAP: Record<string, Omit<CvssResult, "rationale" | "aegis_coverage">> = {
  prompt_injection: {
    cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:L/SI:L/SA:N",
    cvss_score: 9.3,
    severity: "critical",
    attack_vector: "Network",
    attack_complexity: "Low",
    privileges_required: "None",
    user_interaction: "None",
    confidentiality: "High",
    integrity: "High",
    availability: "None",
  },
  data_exfiltration: {
    cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:R/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    cvss_score: 8.1,
    severity: "high",
    attack_vector: "Network",
    attack_complexity: "Low",
    privileges_required: "None",
    user_interaction: "Required",
    confidentiality: "High",
    integrity: "None",
    availability: "None",
  },
  jailbreak: {
    cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:L/SI:H/SA:N",
    cvss_score: 8.7,
    severity: "high",
    attack_vector: "Network",
    attack_complexity: "Low",
    privileges_required: "None",
    user_interaction: "None",
    confidentiality: "Low",
    integrity: "High",
    availability: "None",
  },
  indirect_injection: {
    cvss_vector: "CVSS:4.0/AV:N/AC:H/AT:P/PR:N/UI:A/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N",
    cvss_score: 9.1,
    severity: "critical",
    attack_vector: "Network",
    attack_complexity: "High",
    privileges_required: "None",
    user_interaction: "Active",
    confidentiality: "High",
    integrity: "High",
    availability: "None",
  },
  default: {
    cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N",
    cvss_score: 5.3,
    severity: "medium",
    attack_vector: "Network",
    attack_complexity: "Low",
    privileges_required: "Low",
    user_interaction: "None",
    confidentiality: "Low",
    integrity: "Low",
    availability: "None",
  },
};

function classifyAttack(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("indirect") && lower.includes("inject")) return "indirect_injection";
  if (lower.includes("inject") || lower.includes("prompt injection")) return "prompt_injection";
  if (lower.includes("exfil") || lower.includes("leak") || lower.includes("exfiltrat")) return "data_exfiltration";
  if (lower.includes("jailbreak") || lower.includes("bypass") || lower.includes("guardrail")) return "jailbreak";
  return "default";
}

function heuristicScore(data: z.infer<typeof TriageSchema>): CvssResult {
  const combined = `${data.title} ${data.description} ${data.impact}`;
  const key      = classifyAttack(combined);
  const base     = AI_ATTACK_CVSS_MAP[key] ?? AI_ATTACK_CVSS_MAP["default"]!;

  return {
    ...base,
    rationale: `Heuristic classification: ${key.replace(/_/g, " ")}. Score reflects unauthenticated network access with ${base.confidentiality.toLowerCase()} confidentiality impact on the AI component. Set OPENROUTER_API_KEY for DeepSeek-R1 reasoning analysis.`,
    aegis_coverage: {
      covered:        false,
      matching_rules: [],
      recommendation: "No Aegis rules found for this target. Export findings to Aegis to auto-generate WAF rules.",
    },
  };
}

// ─── OpenRouter / DeepSeek-R1 prompt ─────────────────────────────────────────

function buildTriagePrompt(data: z.infer<typeof TriageSchema>): string {
  return `You are a CVSS 4.0 scoring expert specialising in AI/LLM vulnerabilities. Score this vulnerability report.

## Report
**Title:** ${data.title}
**Affected Component:** ${data.affected_component}
**Description:**
${data.description}

**Reproduction Steps:**
${data.reproduction || "(not provided)"}

**Impact Assessment:**
${data.impact || "(not provided)"}

## Instructions
Analyse the report and return ONLY a JSON object (no markdown, no commentary) with exactly these fields:
{
  "cvss_vector": "CVSS:4.0/AV:.../...",
  "cvss_score": 0.0,
  "severity": "none|low|medium|high|critical",
  "attack_vector": "...",
  "attack_complexity": "...",
  "privileges_required": "...",
  "user_interaction": "...",
  "confidentiality": "...",
  "integrity": "...",
  "availability": "...",
  "rationale": "1-2 sentence justification of the score"
}

Use CVSS 4.0 (not 3.x). For AI/LLM components, consider: prompt injection = high integrity impact, data exfiltration = high confidentiality impact, jailbreak = high integrity + scope change.`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = TriageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // ── Sprint 10: Domain ownership gate ──────────────────────────────────────
  // If target_domain is supplied, require a verified record in target_verifications.
  // Unverified or expired records are rejected to prevent submitting bugs against
  // systems the researcher doesn't own / has no authorisation to test.
  if (data.target_domain) {
    const domain = data.target_domain.toLowerCase().replace(/\.$/, "");
    type VerifRow = { verified: boolean; expires_at: string };
    const { data: verif } = (await supabase
      .from("target_verifications")
      .select("verified, expires_at")
      .eq("user_id", user.id)
      .eq("target_domain", domain)
      .maybeSingle()) as { data: VerifRow | null };

    const verified = verif?.verified === true &&
      new Date(verif.expires_at).getTime() > Date.now();

    if (!verified) {
      return NextResponse.json(
        {
          ok:     false,
          error:  `Domain "${domain}" is not verified. Complete domain verification before submitting a bounty against this target.`,
          code:   "DOMAIN_GATE",
          domain,
        },
        { status: 403 },
      );
    }
  }

  // ── Aegis cross-reference (if scan_id provided) ──────────────────────────
  let aegisCoverage: AegisCoverage = {
    covered:        false,
    matching_rules: [],
    recommendation: "Submit a scan to generate Aegis rules for this target.",
  };

  if (data.scan_id) {
    const { data: rules } = await supabase
      .from("aegis_rules")
      .select("rule_id, pattern, description")
      .eq("scan_id", data.scan_id)
      .limit(20) as { data: Array<{ rule_id: string; pattern: string; description: string }> | null };

    if (rules && rules.length > 0) {
      const combined  = `${data.title} ${data.description}`.toLowerCase();
      const matching  = rules.filter(r =>
        r.pattern && combined.includes(r.pattern.toLowerCase().slice(0, 20)),
      );
      aegisCoverage = {
        covered:        matching.length > 0,
        matching_rules: matching.map(r => r.rule_id),
        recommendation: matching.length > 0
          ? `${matching.length} existing Aegis rule(s) cover this vector. Review and tighten rule specificity.`
          : "No existing Aegis rules match this attack vector. Export to Aegis to generate protective rules.",
      };
    }
  }

  // ── DeepSeek-R1 scoring ───────────────────────────────────────────────────
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterKey) {
    const result = heuristicScore(data);
    result.aegis_coverage = aegisCoverage;
    return NextResponse.json({ ok: true, result, mode: "heuristic" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer":  "https://forgeguard.ai",
        "X-Title":       "ForgeGuard AI — Bounty Vault CVSS Triage",
      },
      body: JSON.stringify({
        model:       "deepseek/deepseek-r1",
        messages:    [{ role: "user", content: buildTriagePrompt(data) }],
        temperature: 0.1,   // low temperature for deterministic scoring
        max_tokens:  800,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      // Fall back to heuristic if OpenRouter is unavailable
      const result = heuristicScore(data);
      result.aegis_coverage = aegisCoverage;
      return NextResponse.json({ ok: true, result, mode: "heuristic_fallback" });
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = completion.choices?.[0]?.message?.content ?? "{}";

    type DeepSeekOut = Omit<CvssResult, "aegis_coverage">;
    let scored: DeepSeekOut;
    try {
      scored = JSON.parse(raw) as DeepSeekOut;
    } catch {
      const result = heuristicScore(data);
      result.aegis_coverage = aegisCoverage;
      return NextResponse.json({ ok: true, result, mode: "heuristic_fallback" });
    }

    const result: CvssResult = {
      ...scored,
      cvss_score:   Math.round((scored.cvss_score ?? 5.0) * 10) / 10,
      aegis_coverage: aegisCoverage,
    };

    return NextResponse.json({ ok: true, result, mode: "deepseek-r1" });

  } catch (err: unknown) {
    const result = heuristicScore(data);
    result.aegis_coverage = aegisCoverage;
    console.error("[bounty/triage] OpenRouter error:", err);
    return NextResponse.json({ ok: true, result, mode: "heuristic_fallback" });
  }
}
