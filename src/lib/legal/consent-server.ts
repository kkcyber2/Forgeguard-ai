import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import {
  buildConsentPayload,
  LEGAL_CONSENT_REPLAY_WINDOW_MS,
  LEGAL_POLICY_VERSION,
  LEGACY_CONSENT_HASH,
  normalizeConsentTargetHost,
} from "@/lib/legal/consent";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left.length !== right.length || left.length !== 64) return false;
  try {
    return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Rebuild the canonical consent payload and compare hashes (constant-time).
 * Mirrors the client Web Crypto SHA-256 exactly.
 */
export function verifyConsentHash(
  userId: string,
  targetHost: string,
  signerName: string,
  policyVersion: string,
  signedAtIso: string,
  providedHash: string,
): boolean {
  if (!providedHash || providedHash === LEGACY_CONSENT_HASH) return false;
  const payload = buildConsentPayload(
    userId,
    targetHost,
    signerName.trim(),
    policyVersion,
    signedAtIso,
  );
  return safeEqualHex(sha256Hex(payload), providedHash);
}

export function isConsentWithinReplayWindow(signedAtIso: string): boolean {
  const signedMs = Date.parse(signedAtIso);
  if (!Number.isFinite(signedMs)) return false;
  return Date.now() - signedMs <= LEGAL_CONSENT_REPLAY_WINDOW_MS;
}

/**
 * Full server-side verification at scan-creation time.
 * `consentedTargetHost` is the target_host stored on the legal_authorizations row;
 * `scanTargetUrl` is the URL the user is scanning now — they must match.
 */
export function verifyConsentRecord(params: {
  userId: string;
  scanTargetUrl: string;
  signerName: string | null;
  policyVersion: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  consentedTargetHost: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const policyVersion = params.policyVersion ?? LEGAL_POLICY_VERSION;
  if (policyVersion !== LEGAL_POLICY_VERSION) {
    return { ok: false, reason: "Unsupported consent policy version." };
  }

  if (!params.signedAt || !isConsentWithinReplayWindow(params.signedAt)) {
    return { ok: false, reason: "Legal authorization expired — sign again." };
  }

  if (!params.signerName || params.signerName.trim().length < 2) {
    return { ok: false, reason: "Consent signer name missing." };
  }

  if (!params.signatureHash) {
    return { ok: false, reason: "Consent signature missing." };
  }

  const scanHost = normalizeConsentTargetHost(params.scanTargetUrl);
  const consentedHost = (params.consentedTargetHost ?? "").trim().toLowerCase();

  if (consentedHost && scanHost && consentedHost !== scanHost) {
    return { ok: false, reason: "Consent target host does not match scan target." };
  }

  const hostForHash = consentedHost || scanHost;
  if (!hostForHash) {
    return { ok: false, reason: "Consent target host missing." };
  }

  const signedAtIso =
    typeof params.signedAt === "string" && params.signedAt.includes("T")
      ? params.signedAt
      : new Date(params.signedAt).toISOString();

  if (
    !verifyConsentHash(
      params.userId,
      hostForHash,
      params.signerName,
      policyVersion,
      signedAtIso,
      params.signatureHash,
    )
  ) {
    return { ok: false, reason: "Consent signature verification failed." };
  }

  return { ok: true };
}
