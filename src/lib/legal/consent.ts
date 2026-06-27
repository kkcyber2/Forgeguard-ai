/** Shared legal consent v2 constants and payload helpers (client + server safe). */

export const LEGAL_POLICY_VERSION = "v1.0-2026" as const;

/** Max age of a consent record before createScan rejects it (replay window). */
export const LEGAL_CONSENT_REPLAY_WINDOW_MS = 30 * 60 * 1000;

export const LEGACY_CONSENT_HASH = "legacy-v1-pre-crypto";

/** Normalize scan target URL → hostname for consent binding. */
export function normalizeConsentTargetHost(targetUrl: string): string {
  const raw = targetUrl.trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Canonical consent payload — must match exactly on client (Web Crypto) and server (Node).
 * Format: userId:targetHost:signerName:policyVersion:signedAtIso
 */
export function buildConsentPayload(
  userId: string,
  targetHost: string,
  signerName: string,
  policyVersion: string,
  signedAtIso: string,
): string {
  return `${userId}:${targetHost}:${signerName}:${policyVersion}:${signedAtIso}`;
}

/** Map DB scan intensity → legal modal intensity for matching. */
export function scanIntensityToLegalIntensity(
  intensity: string,
): "high" | "nuclear" | null {
  const key = intensity.trim().toLowerCase();
  if (key === "aggressive" || key === "high") return "high";
  if (key === "greasy" || key === "nuclear") return "nuclear";
  return null;
}
