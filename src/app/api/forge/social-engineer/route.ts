/**
 * POST /api/forge/social-engineer
 * ─────────────────────────────────────────────────────────────────────────────
 * Marine Swarm — Phishing Awareness Analyzer
 *
 * Analyzes a submitted email (subject + body) for social engineering
 * indicators. Returns a structured breakdown of detected techniques,
 * red flags, urgency signals, and a threat-score for use in employee
 * awareness training dashboards.
 *
 * This endpoint is intentionally one-directional: it ANALYZES suspicious
 * content employees have flagged — it does not generate attack content.
 *
 * Auth: active Supabase session, access_level ≥ 2 (hacker / developer)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Schema ──────────────────────────────────────────────────────────────────

const AnalyzeSchema = z.object({
  subject:  z.string().max(500),
  sender:   z.string().max(500),
  body:     z.string().max(10_000),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PhishAnalysis {
  threat_score:    number;           // 0–100
  verdict:         "clean" | "suspicious" | "likely_phish" | "confirmed_phish";
  techniques:      string[];         // e.g. ["urgency", "authority_spoofing", "typosquat"]
  red_flags:       RedFlag[];
  recommendation:  string;
}

export interface RedFlag {
  indicator: string;
  detail:    string;
  severity:  "low" | "medium" | "high";
}

// ─── Analysis logic (heuristic, no LLM required) ─────────────────────────────

const URGENCY_PHRASES = [
  "urgent", "immediately", "within 24 hours", "within 2 hours", "action required",
  "account suspended", "account locked", "verify now", "expires today",
  "last warning", "final notice", "time sensitive",
];

const AUTHORITY_PHRASES = [
  "ceo", "board", "executive", "helpdesk", "it department", "human resources",
  "accounts payable", "finance team", "security operations", "compliance team",
  "legal team", "your manager", "your supervisor",
];

const SENSITIVE_REQUESTS = [
  "wire transfer", "bank account", "routing number", "sort code", "iban",
  "password", "credentials", "social security", "tax id", "click here to verify",
  "confirm your identity", "update your payment", "invoice attached",
  "docusign", "shared document", "reset your password",
];

const DOMAIN_SPOOF_PATTERNS = [
  /[a-z]+-[a-z]+-[a-z]+\.[a-z]{2,}/i,    // hyphen-heavy lookalike domains
  /[a-z]+corp\.[a-z]{2,}/i,               // <company>corp lookalike
  /[a-z]+secure\.[a-z]{2,}/i,             // <company>secure lookalike
  /[a-z]+portal\.[a-z]{2,}/i,             // <company>portal lookalike
  /support@[^>]+\.[a-z]{2,4}$/im,         // generic support@ on odd TLD
];

function analyzeEmail(
  subject: string,
  sender:  string,
  body:    string,
): PhishAnalysis {
  const lower    = `${subject} ${sender} ${body}`.toLowerCase();
  const redFlags: RedFlag[] = [];
  const techniques: Set<string> = new Set();
  let score = 0;

  // Urgency signals
  const urgencyHits = URGENCY_PHRASES.filter(p => lower.includes(p));
  if (urgencyHits.length >= 3) {
    score += 25;
    techniques.add("urgency_pressure");
    redFlags.push({
      indicator: "Multiple urgency signals",
      detail:    `Detected: "${urgencyHits.slice(0, 3).join('", "')}". Legitimate communications rarely stack urgency cues.`,
      severity:  "high",
    });
  } else if (urgencyHits.length > 0) {
    score += 10;
    techniques.add("urgency_pressure");
    redFlags.push({
      indicator: "Urgency language",
      detail:    `Contains: "${urgencyHits[0]}". Verify through an out-of-band channel before acting.`,
      severity:  "medium",
    });
  }

  // Authority claims
  const authHits = AUTHORITY_PHRASES.filter(p => lower.includes(p));
  if (authHits.length > 0) {
    score += 15;
    techniques.add("authority_spoofing");
    redFlags.push({
      indicator: "Authority claim",
      detail:    `Claims authority via "${authHits[0]}". Always verify sender identity independently before complying.`,
      severity:  "medium",
    });
  }

  // Sensitive request detection
  const sensitiveHits = SENSITIVE_REQUESTS.filter(p => lower.includes(p));
  if (sensitiveHits.length >= 2) {
    score += 30;
    techniques.add("credential_harvesting");
    redFlags.push({
      indicator: "Sensitive data request",
      detail:    `Requests: "${sensitiveHits.slice(0, 2).join('", "')}". Legitimate internal systems never request credentials by email.`,
      severity:  "high",
    });
  } else if (sensitiveHits.length === 1) {
    score += 15;
    redFlags.push({
      indicator: "Sensitive request",
      detail:    `Mentions "${sensitiveHits[0]}". Treat with caution.`,
      severity:  "medium",
    });
  }

  // Domain spoofing patterns in sender
  const spoofMatch = DOMAIN_SPOOF_PATTERNS.find(re => re.test(sender));
  if (spoofMatch) {
    score += 20;
    techniques.add("domain_spoofing");
    redFlags.push({
      indicator: "Suspicious sender domain",
      detail:    `"${sender}" matches a known lookalike domain pattern. Check the actual From header in your email client.`,
      severity:  "high",
    });
  }

  // Request for secrecy
  if (lower.includes("confidential") && (lower.includes("do not discuss") || lower.includes("between us") || lower.includes("do not forward"))) {
    score += 25;
    techniques.add("isolation_tactic");
    redFlags.push({
      indicator: "Secrecy request",
      detail:    "Asks you to keep the request confidential. This is a hallmark of CEO-fraud / BEC attacks.",
      severity:  "high",
    });
  }

  // External link pressure
  if (/https?:\/\//i.test(body) && urgencyHits.length > 0) {
    score += 10;
    techniques.add("link_delivery");
    redFlags.push({
      indicator: "Urgent link",
      detail:    "Contains external URLs combined with urgency language. Hover over links before clicking — check the actual destination.",
      severity:  "medium",
    });
  }

  // Clamp score
  score = Math.min(score, 100);

  const verdict: PhishAnalysis["verdict"] =
    score >= 70 ? "confirmed_phish" :
    score >= 45 ? "likely_phish"    :
    score >= 20 ? "suspicious"      : "clean";

  const recommendation =
    verdict === "confirmed_phish" ? "Do not click any links or reply. Report to your security team immediately via your organisation's phishing report button." :
    verdict === "likely_phish"    ? "High likelihood of phishing. Verify the sender via phone or a separate email chain before taking any action." :
    verdict === "suspicious"      ? "Some indicators present. Independently verify the request before complying." :
    "No significant phishing indicators detected. Maintain normal vigilance.";

  return {
    threat_score:   score,
    verdict,
    techniques:     Array.from(techniques),
    red_flags:      redFlags,
    recommendation,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  // ── Identity gate ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle() as { data: { access_level: number | null } | null };

  if (!profile || (profile.access_level ?? 0) < 2) {
    return NextResponse.json(
      { ok: false, error: "Marine Swarm requires Hacker or Developer identity.", code: "IDENTITY_GATE" },
      { status: 403 },
    );
  }

  // ── Parse + analyze ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Bad request" },
      { status: 400 },
    );
  }

  const { subject, sender, body: emailBody } = parsed.data;
  const analysis = analyzeEmail(subject, sender, emailBody);

  return NextResponse.json({ ok: true, analysis });
}
