import {
  buildConsentPayload,
  LEGAL_POLICY_VERSION,
  normalizeConsentTargetHost,
} from "@/lib/legal/consent";

/** SHA-256 hex digest via Web Crypto API (browser only). */
export async function sha256HexWebCrypto(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildLegalConsentSignature(params: {
  userId: string;
  targetUrl: string;
  signerName: string;
  signedAtIso?: string;
}): Promise<{
  targetHost: string;
  policyVersion: string;
  signedAtIso: string;
  signatureHash: string;
}> {
  const signedAtIso = params.signedAtIso ?? new Date().toISOString();
  const targetHost = normalizeConsentTargetHost(params.targetUrl);
  const payload = buildConsentPayload(
    params.userId,
    targetHost,
    params.signerName.trim(),
    LEGAL_POLICY_VERSION,
    signedAtIso,
  );
  const signatureHash = await sha256HexWebCrypto(payload);
  return {
    targetHost,
    policyVersion: LEGAL_POLICY_VERSION,
    signedAtIso,
    signatureHash,
  };
}
