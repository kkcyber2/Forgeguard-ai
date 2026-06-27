/**
 * Scope enforcement — pure host normalization + scope containment.
 *
 * The ownership token proves a user controls *some* host. createScan must
 * additionally guarantee the scan target's host is WITHIN the verified host
 * (apex or a subdomain of it). This module is dependency-free and
 * unit-testable so the trust math is auditable in isolation.
 */

/**
 * Normalize a URL/host to a canonical hostname.
 *
 * - lowercase
 * - strip a single trailing dot
 * - drop default ports (:80 / :443)
 * - strip a leading "www."
 * - return null on an invalid URL or empty host
 */
export function normalizeHost(url: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;

  // Accept a bare host ("example.com") by promoting it to a URL. Anything
  // containing a slash or scheme goes through the URL parser; a bare host
  // with no scheme would otherwise parse as a pathname.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let host: string;
  try {
    host = new URL(withProtocol).hostname;
  } catch {
    return null;
  }

  if (!host) return null;

  host = host.toLowerCase().replace(/\.$/, "");

  // Drop default ports if the URL parser kept them.
  host = host.replace(/:(80|443)$/, "");

  // Strip a single leading "www." label — www.example.com and example.com
  // share one verified scope.
  host = host.replace(/^www\./, "");

  return host || null;
}

/**
 * True when `targetHost` is within the verified `verifiedHost` scope.
 *
 * Containment is:
 *   - exact match (both normalized), OR
 *   - targetHost is a subdomain of verifiedHost (ends with "." + apex)
 *
 * Both inputs are normalized internally so callers may pass raw URLs.
 *
 * Examples:
 *   isWithinScope("api.example.com", "example.com")   → true
 *   isWithinScope("example.com", "example.com")       → true
 *   isWithinScope("victim.com", "example.com")        → false
 *   isWithinScope("notexample.com", "example.com")    → false  (suffix ≠ label)
 */
export function isWithinScope(
  targetHost: string,
  verifiedHost: string,
): boolean {
  const target = normalizeHost(targetHost);
  const verified = normalizeHost(verifiedHost);
  if (!target || !verified) return false;
  if (target === verified) return true;
  // Subdomain check: must be exactly "<label>...<.apex>" — guard against
  // "notexample.com" matching a "example.com" suffix.
  return target.endsWith(`.${verified}`);
}
