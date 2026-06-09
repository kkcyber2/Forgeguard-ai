/**
 * Derive WAF-ready regex patterns from attack strings (breach evidence / prompts).
 */

const META_CHARS = /[.*+?^${}()|[\]\\]/g;

/** Escape user attack text for safe inclusion in a regex character class or alternation. */
export function escapeRegexLiteral(input: string): string {
  return input.replace(META_CHARS, "\\$&");
}

/**
 * Build a blocking regex from the attack string — prefers distinctive tokens (≥4 chars).
 */
export function attackStringToRegex(attack: string): string {
  const raw = attack.trim();
  if (!raw) return "(?i)forgeguard-aegis-block";

  const tokens = raw
    .split(/[\s,.;:!?'"()[\]{}]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .slice(0, 6);

  if (tokens.length === 0) {
    const slice = raw.slice(0, 80);
    return `(?i)${escapeRegexLiteral(slice)}`;
  }

  const parts = tokens.map((t) => escapeRegexLiteral(t));
  return `(?i)(?:${parts.join("|")})`;
}

export type AegisDefenseExport = {
  rule_id: string;
  description: string;
  pattern: string;
  generated_at: string;
  scan_id: string;
  finding_id: string;
  cloudflare: {
    name: string;
    description: string;
    kind: "custom";
    phase: "http_request_firewall_custom";
    rules: Array<{
      description: string;
      expression: string;
      action: "block";
      enabled: boolean;
    }>;
  };
  nginx: {
    description: string;
    location: "/api/";
    rules: Array<{
      name: string;
      pattern: string;
      action: "deny";
    }>;
  };
};

export function buildDefenseExport(params: {
  scanId: string;
  findingId: string;
  ruleId: string;
  description: string;
  pattern: string;
}): AegisDefenseExport {
  const cfExpression = `(http.request.body.raw matches r"${params.pattern.replace(/\\/g, "\\\\")}") and http.request.uri.path contains "/api/"`;

  return {
    rule_id: params.ruleId,
    description: params.description,
    pattern: params.pattern,
    generated_at: new Date().toISOString(),
    scan_id: params.scanId,
    finding_id: params.findingId,
    cloudflare: {
      name: "ForgeGuard Aegis — Breach Rule",
      description: params.description,
      kind: "custom",
      phase: "http_request_firewall_custom",
      rules: [
        {
          description: `[ForgeGuard Aegis] ${params.description}`,
          expression: cfExpression,
          action: "block",
          enabled: true,
        },
      ],
    },
    nginx: {
      description: params.description,
      location: "/api/",
      rules: [
        {
          name: params.ruleId,
          pattern: params.pattern,
          action: "deny",
        },
      ],
    },
  };
}
