/**
 * Mask credential-like tokens before rendering scan diagnostics, reports, or PDFs.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bsk-[a-zA-Z0-9]{8,}\b/g,
  /\bghp_[a-zA-Z0-9]{20,}\b/g,
  /\bxoxb-[a-zA-Z0-9-]{20,}\b/g,
];

function maskMatch(match: string): string {
  if (match.length <= 8) return "[REDACTED]";
  return `${match.slice(0, 4)}…[REDACTED]…${match.slice(-4)}`;
}

/** Redact known secret patterns in free-form text (logs, evidence, failure_reason). */
export function redactSecrets(input: string | null | undefined): string {
  if (!input) return "";
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (m) => maskMatch(m));
  }
  return out;
}
