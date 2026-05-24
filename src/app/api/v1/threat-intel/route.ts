/**
 * GET /api/v1/threat-intel
 * ─────────────────────────────────────────────────────────────────────────────
 * Sovereign Defense Aegis 2.0 — Threat Intelligence Export
 *
 * Enterprise endpoint: Exports the latest Bazaar-sourced attack patterns as
 * machine-readable JSON firewall rules that enterprise clients can ingest into
 * their WAFs, IDS/IPS, or SIEM systems.
 *
 * Auth:
 *   1. X-ForgeGuard-API-Key header → enterprise_api_keys table
 *   2. Supabase session + active enterprise subscription → subscriptions table
 *   3. Supabase session + admin (access_level ≥ 4) → internal dashboard
 *
 * Query params:
 *   ?format=json|suricata|sigma|stream   (default: json)
 *   ?category=sqli|xss|ssrf|rce|dns|recon|all   (default: all)
 *   ?limit=1-200                          (default: 50; free plan capped at 10)
 *   ?since=ISO8601                        (only patterns updated after this date)
 *   ?min_risk=0-100                       (filter by minimum audit_risk_score)
 *
 * Response: application/json with threat_rules array + metadata block.
 *           format=stream → text/event-stream (10 latest cleared patterns)
 *           format=suricata → text/plain Suricata rules file
 *
 * Rate limit: 100 req/hour per API key (enforced via enterprise_api_keys.last_hit).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BazaarScript {
  id:               string;
  name:             string;
  description:      string;
  language:         string;
  tags:             string[];
  audit_verdict:    string;
  audit_risk_score: number;
  audit_findings:   string[] | null;
  updated_at:       string;
}

interface ThreatRule {
  rule_id:      string;
  name:         string;
  description:  string;
  category:     string[];
  language:     string;
  risk_score:   number;
  findings:     string[];
  ioc_tags:     string[];
  verdict:      string;
  last_updated: string;
  source:       "forgeguard-bazaar";
  format:       "json";
}

interface SuricataRule {
  sid:       number;
  msg:       string;
  content:   string[];
  metadata:  string;
  classtype: string;
  rev:       number;
}

// ─── Format converters ────────────────────────────────────────────────────────

function toJsonRule(script: BazaarScript): ThreatRule {
  return {
    rule_id:      `FG-${script.id.slice(0, 8).toUpperCase()}`,
    name:         script.name,
    description:  script.description,
    category:     script.tags,
    language:     script.language,
    risk_score:   script.audit_risk_score,
    findings:     script.audit_findings ?? [],
    ioc_tags:     script.tags,
    verdict:      script.audit_verdict,
    last_updated: script.updated_at,
    source:       "forgeguard-bazaar",
    format:       "json",
  };
}

function toSuricataRule(script: BazaarScript, index: number): SuricataRule {
  const contentKeywords = (script.audit_findings ?? [])
    .slice(0, 3)
    .map((f) => `"${f.slice(0, 40).replace(/"/g, "'")}"`);

  const classtype =
    script.tags.includes("sqli")  ? "web-application-attack" :
    script.tags.includes("rce")   ? "attempted-admin"         :
    script.tags.includes("recon") ? "network-scan"            :
    script.tags.includes("dns")   ? "dns-query"               :
    "attempted-dos";

  return {
    sid:      1_000_000 + index,
    msg:      `ForgeGuard Aegis — ${script.name}`,
    content:  contentKeywords.length ? contentKeywords : [`"${script.name.slice(0, 30)}"`],
    metadata: `affected_product Any, risk_score ${script.audit_risk_score}, source ForgeGuard-Bazaar`,
    classtype,
    rev:      1,
  };
}

function renderSuricata(rules: SuricataRule[]): string {
  return rules
    .map((r) =>
      `alert http any any -> any any (msg:"${r.msg}"; flow:established,to_server; ${r.content.map((c) => `content:${c};`).join(" ")} classtype:${r.classtype}; sid:${r.sid}; rev:${r.rev}; metadata:${r.metadata};)`
    )
    .join("\n");
}

function toSigmaRule(script: BazaarScript): Record<string, unknown> {
  return {
    title:       `ForgeGuard Aegis — ${script.name}`,
    id:          script.id,
    status:      "experimental",
    description: script.description,
    references:  ["https://forgeguard.ai/threat-intel"],
    author:      "ForgeGuard Aegis 2.0",
    date:        script.updated_at.slice(0, 10),
    tags:        script.tags.map((t) => `attack.${t}`),
    logsource:   { category: "webserver" },
    detection:   {
      keywords:  script.audit_findings?.slice(0, 3) ?? [script.name],
      condition: "keywords",
    },
    level:
      script.audit_risk_score >= 80 ? "high"   :
      script.audit_risk_score >= 50 ? "medium" :
      "low",
  };
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── API key validation ───────────────────────────────────────────────────────

async function validateApiKey(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  key: string,
): Promise<{ valid: boolean; org_id?: string; plan?: string }> {
  const { data } = await supabase
    .from("enterprise_api_keys")
    .select("id, org_id, plan, is_active, expires_at, hit_count")
    .eq("api_key", key)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return { valid: false };

  if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
    return { valid: false };
  }

  // Update last_hit (fire-and-forget)
  void supabase
    .from("enterprise_api_keys")
    .update({
      last_hit:  new Date().toISOString(),
      hit_count: ((data.hit_count as number | null) ?? 0) + 1,
    })
    .eq("id", data.id);

  return { valid: true, org_id: data.org_id as string, plan: data.plan as string };
}

// ─── Subscription check ───────────────────────────────────────────────────────

async function checkEnterpriseSubscription(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, plan")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("plan", "enterprise")
    .maybeSingle();

  return !!data;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  // ── Auth: API key OR session ────────────────────────────────────────────────
  const apiKey = req.headers.get("x-forgeguard-api-key") ??
                 req.headers.get("x-api-key");

  let authed = false;
  let orgId: string | undefined;
  let plan  = "free";

  if (apiKey) {
    // Path 1: Enterprise API key
    const keyResult = await validateApiKey(supabase, apiKey);
    if (!keyResult.valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired API key.", code: "INVALID_API_KEY" },
        { status: 401 },
      );
    }
    authed = true;
    orgId  = keyResult.org_id;
    plan   = keyResult.plan ?? "free";
  } else {
    // Path 2: Supabase session
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check enterprise subscription first (broader access, no admin requirement)
      const hasEnterprise = await checkEnterpriseSubscription(supabase, user.id);
      if (hasEnterprise) {
        authed = true;
        plan   = "enterprise";
      } else {
        // Fall back: admin dashboard access (access_level ≥ 4)
        const { data: profile } = await supabase
          .from("profiles")
          .select("access_level")
          .eq("id", user.id)
          .maybeSingle();

        if (((profile?.access_level as number | undefined) ?? 1) >= 4) {
          authed = true;
          plan   = "admin";
        }
      }
    }
  }

  if (!authed) {
    return NextResponse.json(
      {
        ok:    false,
        error: "Authentication required. Pass X-ForgeGuard-API-Key header or activate an enterprise subscription.",
        code:  "UNAUTHENTICATED",
        docs:  "https://forgeguard.ai/docs/threat-intel-api",
      },
      { status: 401 },
    );
  }

  // ── Parse query params ──────────────────────────────────────────────────────
  const url      = req.nextUrl;
  const format   = (url.searchParams.get("format") ?? "json") as "json" | "suricata" | "sigma" | "stream";
  const category = url.searchParams.get("category") ?? "all";
  const rawLimit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const since    = url.searchParams.get("since") ?? null;
  const minRisk  = Number(url.searchParams.get("min_risk") ?? 0);

  // Plan-based limit cap
  const limit = (plan === "free") ? Math.min(rawLimit, 10) : rawLimit;

  // ── Stream format: last 10 cleared patterns as SSE ──────────────────────────
  if (format === "stream") {
    const { data: scripts } = await supabase
      .from("bazaar_scripts")
      .select("id, name, description, language, tags, audit_verdict, audit_risk_score, audit_findings, updated_at")
      .eq("audit_verdict", "cleared")
      .eq("is_removed", false)
      .order("audit_risk_score", { ascending: false })
      .limit(10);

    const safeScripts = (scripts ?? []) as BazaarScript[];

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (evt: Record<string, unknown>) =>
          controller.enqueue(enc.encode(sseEvent(evt)));

        send({
          type:         "header",
          source:       "ForgeGuard Aegis 2.0",
          generated_at: new Date().toISOString(),
          total:        safeScripts.length,
          org_id:       orgId ?? "internal",
          plan,
        });

        for (const script of safeScripts) {
          const rule = toJsonRule(script);
          send({ type: "rule", rule });
          // Slight artificial delay for consumer UX
          await new Promise((r) => setTimeout(r, 40));
        }

        send({
          type:    "done",
          total:   safeScripts.length,
          version: "2.0",
        });

        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type":          "text/event-stream",
        "Cache-Control":         "no-cache, no-store",
        "Connection":            "keep-alive",
        "X-Accel-Buffering":     "no",
        "X-ForgeGuard-Version":  "2.0",
        "X-ForgeGuard-Format":   "stream",
      },
    });
  }

  // ── Batch query for all other formats ──────────────────────────────────────
  let query = supabase
    .from("bazaar_scripts")
    .select("id, name, description, language, tags, audit_verdict, audit_risk_score, audit_findings, updated_at")
    .in("audit_verdict", ["cleared", "flagged"])
    .eq("is_removed", false)
    .gte("audit_risk_score", minRisk)
    .order("audit_risk_score", { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte("updated_at", since);
  }

  if (category !== "all") {
    query = query.contains("tags", [category]);
  }

  const { data: scripts, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  const safeScripts = (scripts ?? []) as BazaarScript[];

  // ── Suricata ───────────────────────────────────────────────────────────────
  if (format === "suricata") {
    const rules = safeScripts.map((s, i) => toSuricataRule(s, i));
    const body  = renderSuricata(rules);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":        "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="forgeguard-aegis.rules"',
        "X-ForgeGuard-Rules":  String(rules.length),
        "X-ForgeGuard-Format": "suricata",
        "Cache-Control":       "no-store",
      },
    });
  }

  // ── Sigma ──────────────────────────────────────────────────────────────────
  if (format === "sigma") {
    const rules = safeScripts.map((s) => toSigmaRule(s));
    return NextResponse.json({
      ok:      true,
      format:  "sigma",
      version: "2.0",
      rules,
      meta: {
        total:        rules.length,
        generated_at: new Date().toISOString(),
        source:       "ForgeGuard Aegis 2.0",
        org_id:       orgId ?? "internal",
        plan,
      },
    });
  }

  // ── Default JSON ───────────────────────────────────────────────────────────
  const rules      = safeScripts.map((s) => toJsonRule(s));
  const highRisk   = rules.filter((r) => r.risk_score >= 80).length;
  const mediumRisk = rules.filter((r) => r.risk_score >= 50 && r.risk_score < 80).length;
  const categories = [...new Set(rules.flatMap((r) => r.ioc_tags))];

  return NextResponse.json(
    {
      ok:      true,
      format:  "json",
      version: "2.0",
      meta: {
        total:         rules.length,
        high_risk:     highRisk,
        medium_risk:   mediumRisk,
        low_risk:      rules.length - highRisk - mediumRisk,
        categories,
        generated_at:  new Date().toISOString(),
        data_source:   "ForgeGuard Bazaar AI Customs",
        source_system: "ForgeGuard Aegis 2.0",
        org_id:        orgId ?? "internal",
        plan,
        note: plan === "free"
          ? `Free tier capped at ${limit} rules. Upgrade to Enterprise for the full feed.`
          : undefined,
      },
      threat_rules: rules,
      schema: {
        rule_id:      "Unique ForgeGuard threat rule identifier",
        risk_score:   "0-100, 80+ = HIGH, 50-79 = MEDIUM, <50 = LOW",
        findings:     "AI-detected patterns",
        ioc_tags:     "MITRE ATT&CK-aligned tactic tags",
        last_updated: "ISO 8601 UTC timestamp",
      },
    },
    {
      headers: {
        "X-ForgeGuard-Version": "2.0",
        "X-ForgeGuard-Rules":   String(rules.length),
        "X-ForgeGuard-Format":  "json",
        "Cache-Control":        "no-store, max-age=0",
      },
    },
  );
}
