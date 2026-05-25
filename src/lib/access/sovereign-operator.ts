/**
 * Sovereign operator allowlist — ONLY ksk805763@gmail.com may access /admin
 * and sovereign features. Hard-locked; not overridable via env.
 */

export const SOVEREIGN_OPERATOR_EMAIL = "ksk805763@gmail.com" as const;

export function getSovereignOperatorEmail(): string {
  return SOVEREIGN_OPERATOR_EMAIL;
}

export function isSovereignOperator(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SOVEREIGN_OPERATOR_EMAIL;
}
