import { createHash } from "crypto";

/**
 * Chain-of-custody seal: SHA-256(signature + user_id + ISO timestamp).
 */
export function buildCustodyHash(
  signatureData: string,
  userId: string,
  signedAt: string,
): string {
  return createHash("sha256")
    .update(`${userId}|${signedAt}|${signatureData}`)
    .digest("hex");
}
