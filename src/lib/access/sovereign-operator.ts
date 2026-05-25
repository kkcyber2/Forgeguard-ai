/**
 * Sovereign operator allowlist — ksk805763@gmail.com is the canonical operator.
 * Also accepts ADMIN_EMAIL and SOVEREIGN_OPERATOR_EMAIL env vars as fallbacks
 * to prevent lockouts when Vercel/Railway env naming differs.
 */

export const SOVEREIGN_OPERATOR_EMAIL = "ksk805763@gmail.com" as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** All emails that may pass the Sovereign Identity Gate. */
export function getSovereignAllowlist(): readonly string[] {
  const allow = new Set<string>([SOVEREIGN_OPERATOR_EMAIL]);

  for (const key of ["SOVEREIGN_OPERATOR_EMAIL", "ADMIN_EMAIL"] as const) {
    const val = process.env[key]?.trim();
    if (val) allow.add(normalizeEmail(val));
  }

  return [...allow];
}

/** Primary operator email for display/logging (env override → hard default). */
export function getSovereignOperatorEmail(): string {
  return (
    process.env.SOVEREIGN_OPERATOR_EMAIL?.trim().toLowerCase() ||
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
    SOVEREIGN_OPERATOR_EMAIL
  );
}

export function isSovereignOperator(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getSovereignAllowlist().includes(normalizeEmail(email));
}

/** Mask email for server logs — e.g. ks***@gmail.com */
export function maskOperatorEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "[invalid]";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
