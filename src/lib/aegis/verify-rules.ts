/**
 * Edge-safe Aegis rule fetch + prompt match (no server-only / Node deps).
 */

export type AegisRuleSlice = {
  rule_content: string | null;
  pattern: string | null;
};

export function ruleContentInPrompt(prompt: string, ruleContent: string): boolean {
  const needle = ruleContent.trim();
  if (!needle || needle.length < 4) return false;
  return prompt.toLowerCase().includes(needle.toLowerCase());
}

export function promptMatchesRules(
  prompt: string,
  rules: AegisRuleSlice[],
): boolean {
  for (const rule of rules) {
    const content = (rule.rule_content ?? rule.pattern ?? "").trim();
    if (content && ruleContentInPrompt(prompt, content)) {
      return true;
    }
  }
  return false;
}

/** Single REST round-trip — tuned for sub-50ms on warm Edge. */
export async function fetchActiveAegisRules(
  appId: string,
): Promise<AegisRuleSlice[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    throw new Error("Supabase env not configured");
  }

  const params = new URLSearchParams({
    select: "rule_content,pattern",
    app_id: `eq.${appId}`,
    enabled: "eq.true",
    limit: "64",
  });

  const resp = await fetch(`${base}/rest/v1/aegis_rules?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`aegis_rules fetch ${resp.status}`);
  }

  return (await resp.json()) as AegisRuleSlice[];
}
