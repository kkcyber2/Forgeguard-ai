/**
 * Sovereign operator allowlist — only this email may access /admin and sovereign features.
 * Override via SOVEREIGN_OPERATOR_EMAIL env var on Vercel.
 */

const DEFAULT_SOVEREIGN_EMAIL = "ksk805763@gmail.com";

export function getSovereignOperatorEmail(): string {
  return (
    process.env.SOVEREIGN_OPERATOR_EMAIL?.trim().toLowerCase() ||
    DEFAULT_SOVEREIGN_EMAIL
  );
}

export function isSovereignOperator(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getSovereignOperatorEmail();
}
