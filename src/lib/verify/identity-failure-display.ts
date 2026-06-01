/** Operator-facing copy for profiles.identity_failure_reason */

export function formatIdentityFailureTruth(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) return trimmed;

  if (
    /HTTP\s*402/i.test(trimmed) ||
    /DeepSeek-R1 rejected request \(HTTP 402\)/i.test(trimmed) ||
    /insufficient.*credit/i.test(trimmed) ||
    /payment required/i.test(trimmed)
  ) {
    return (
      "OpenRouter API credits exhausted (HTTP 402). Top up billing at openrouter.ai " +
      "to restore DeepSeek-R1 identity audits."
    );
  }

  return trimmed;
}

export function isOpenRouterCreditsExhausted(reason: string): boolean {
  return /HTTP\s*402|insufficient.*credit|payment required/i.test(reason);
}
