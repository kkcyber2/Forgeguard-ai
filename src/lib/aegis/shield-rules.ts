/**
 * Helpers for aegis_shield_rules — pattern extraction and default app scope.
 */

/** Stable app_id for a user's exported shield rules (matches Sovereign Proxy Config). */
export function defaultAegisAppId(userId: string): string {
  return `fg-${userId.replace(/-/g, "").slice(0, 12)}`;
}

/** Derive a WAF/regex pattern from remediation_code_snippet or remediation text. */
export function snippetToShieldPattern(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const regexLine = s.match(/(?:pattern|regex|expression)\s*[:=]\s*['"]([^'"]+)['"]/i);
  if (regexLine?.[1]) return regexLine[1].slice(0, 500);

  const slashMatch = s.match(/\/([^/\\]+(?:\\.[^/\\]*)*)\/[gimsuy]*/);
  if (slashMatch?.[1]) return slashMatch[1].slice(0, 500);

  if (s.startsWith("^") || s.includes("(?") || s.includes("\\b")) {
    return s.slice(0, 500);
  }

  const line = s.split("\n").find((l) => l.trim().length > 8)?.trim() ?? s;
  return line.slice(0, 500);
}
