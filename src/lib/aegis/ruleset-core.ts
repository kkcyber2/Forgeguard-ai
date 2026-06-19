/**
 * Aegis ruleset core — shared Cloudflare WAF generation + DB row mapping.
 * Used by POST /api/aegis/export and auto-evolve on scan.completed.
 */

export interface ScanFinding {
  id: number;
  type: string;
  severity: string;
  attack_name: string | null;
  payload: unknown;
  created_at: string;
}

export interface CloudflareRule {
  description: string;
  expression: string;
  action: "block" | "challenge" | "log";
  action_params?: Record<string, unknown>;
  enabled: boolean;
  ref: string;
}

export interface CloudflareRuleset {
  name: string;
  description: string;
  kind: "custom";
  phase: "http_request_firewall_custom";
  rules: CloudflareRule[];
  meta: {
    generated_by: string;
    scan_id: string;
    generated_at: string;
    rule_count: number;
  };
}

export const TECHNIQUE_PATTERNS: Record<
  string,
  { expression: string; action: "block" | "challenge"; label: string }
> = {
  homoglyph: {
    expression: `(http.request.body.raw contains "\\u0430" or http.request.body.raw contains "\\u0435" or http.request.body.raw contains "\\u043e") and http.request.uri.path contains "/api/"`,
    action: "block",
    label: "Homoglyph / Unicode confusable injection",
  },
  prompt_injection: {
    expression: `(http.request.body.raw contains "ignore previous instructions" or http.request.body.raw contains "ignore all prior" or http.request.body.raw contains "disregard your") and http.request.uri.path contains "/api/"`,
    action: "block",
    label: "Direct prompt injection",
  },
  jailbreak: {
    expression: `(http.request.body.raw contains "DAN" or http.request.body.raw contains "do anything now" or http.request.body.raw contains "developer mode" or http.request.body.raw contains "jailbreak") and http.request.uri.path contains "/api/"`,
    action: "block",
    label: "Jailbreak / role override attempt",
  },
  role_confusion: {
    expression: `(http.request.body.raw contains "maintenance mode" or http.request.body.raw contains "admin mode" or http.request.body.raw contains "system update") and http.request.uri.path contains "/api/"`,
    action: "block",
    label: "Authority spoofing / role confusion",
  },
  markdown_exfil: {
    expression: `http.request.body.raw matches r"!\\[.*\\]\\(https?://[^)]+\\)" and not http.request.uri.path contains "/upload"`,
    action: "challenge",
    label: "Markdown image exfiltration probe",
  },
  indirect_injection: {
    expression: `(http.request.body.raw contains "fetch(" or http.request.body.raw contains "XMLHttpRequest" or http.request.body.raw contains "navigator.sendBeacon") and http.request.uri.path contains "/api/"`,
    action: "block",
    label: "Indirect prompt injection via JS payload",
  },
  default: {
    expression: `http.request.body.raw contains "system prompt" and http.request.uri.path contains "/api/"`,
    action: "challenge",
    label: "Generic system-prompt extraction attempt",
  },
};

export function techniqueKey(finding: ScanFinding): string {
  const name = (finding.attack_name ?? "").toLowerCase();
  if (name.includes("homoglyph")) return "homoglyph";
  if (name.includes("jailbreak") || name.includes("bypass")) return "jailbreak";
  if (name.includes("role") || name.includes("authority") || name.includes("escalat")) {
    return "role_confusion";
  }
  if (name.includes("markdown") || name.includes("exfil")) return "markdown_exfil";
  if (name.includes("indirect")) return "indirect_injection";
  if (name.includes("inject")) return "prompt_injection";
  return "default";
}

export function buildCloudflareRuleset(scanId: string, findings: ScanFinding[]): CloudflareRuleset {
  const seen = new Set<string>();
  const rules: CloudflareRule[] = [];

  for (const finding of findings) {
    if (finding.severity === "info") continue;

    const key = techniqueKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);

    const tpl = TECHNIQUE_PATTERNS[key] ?? TECHNIQUE_PATTERNS.default!;
    const ref = `fg-aegis-${key}-${Date.now().toString(36)}`;

    rules.push({
      description: `[ForgeGuard Aegis] ${tpl.label}`,
      expression: tpl.expression,
      action: tpl.action,
      enabled: true,
      ref,
    });
  }

  rules.push({
    description: "[ForgeGuard Aegis] Rate-limit sentinel — LLM API endpoints",
    expression: `http.request.uri.path matches r"/api/(chat|scan|forge|completions)" and cf.threat_score gt 10`,
    action: "challenge",
    enabled: true,
    ref: `fg-aegis-ratelimit-${Date.now().toString(36)}`,
  });

  return {
    name: "ForgeGuard Aegis Ruleset",
    description: `Auto-generated from ForgeGuard scan ${scanId}. Review before deployment.`,
    kind: "custom",
    phase: "http_request_firewall_custom",
    rules,
    meta: {
      generated_by: "ForgeGuard AI — Aegis Defense v1",
      scan_id: scanId,
      generated_at: new Date().toISOString(),
      rule_count: rules.length,
    },
  };
}

export function aegisRulesToRows(
  scanId: string,
  ruleset: CloudflareRuleset,
): Array<{
  scan_id: string;
  rule_id: string;
  pattern: string;
  description: string;
  action: string;
  format: string;
  enabled: boolean;
}> {
  return ruleset.rules.map((r) => ({
    scan_id: scanId,
    rule_id: r.ref,
    pattern: r.expression.slice(0, 500),
    description: r.description,
    action: r.action,
    format: "cloudflare",
    enabled: r.enabled,
  }));
}
