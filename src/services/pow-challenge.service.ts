/**
 * Aggressive SHA-256 proof-of-work challenges for high-volume scrapers.
 * Forces attacker CPU spend before edge responses are served.
 */

/** Default leading-zero hex digits required (difficulty 4 ≈ 65536 hashes). */
export const POW_DEFAULT_DIFFICULTY = 4;

/** Requests per minute before PoW is enforced for suspicious clients. */
export const POW_VOLUME_THRESHOLD = 30;

const POW_HEADER = "x-aegis-pow";

export type PowChallenge = {
  challenge: string;
  difficulty: number;
  algorithm: "sha256";
};

/**
 * Mint a deterministic PoW challenge bound to client IP and current hour bucket.
 */
export function mintPowChallenge(ip: string, difficulty = POW_DEFAULT_DIFFICULTY): PowChallenge {
  const hour = Math.floor(Date.now() / 3_600_000);
  const challenge = `forgeguard:${ip}:${hour}:${crypto.randomUUID()}`;
  return { challenge, difficulty, algorithm: "sha256" };
}

/**
 * Parse `nonce:hash` from the client PoW header.
 */
export function parsePowHeader(raw: string | null): { nonce: string; hash: string } | null {
  if (!raw?.trim()) return null;
  const sep = raw.indexOf(":");
  if (sep <= 0) return null;
  const nonce = raw.slice(0, sep).trim();
  const hash = raw.slice(sep + 1).trim().toLowerCase();
  if (!nonce || !hash) return null;
  return { nonce, hash };
}

/**
 * Verify client-submitted SHA-256 proof against the issued challenge.
 */
export async function verifyPowSolution(
  challenge: string,
  nonce: string,
  hashHex: string,
  difficulty: number,
): Promise<boolean> {
  const prefix = "0".repeat(Math.max(1, difficulty));
  if (!hashHex.startsWith(prefix)) return false;
  const data = new TextEncoder().encode(`${challenge}:${nonce}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const computed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === hashHex.toLowerCase();
}

/** Header name clients must send after solving PoW. */
export function powHeaderName(): string {
  return POW_HEADER;
}

/**
 * Build a 429 JSON body instructing the client to solve PoW before retrying.
 */
export function powChallengeResponseBody(challenge: PowChallenge): Record<string, unknown> {
  return {
    error: "proof_of_work_required",
    message: "Compute SHA-256 until hash prefix matches difficulty, then retry with x-aegis-pow header.",
    ...challenge,
    header: POW_HEADER,
    format: "nonce:hashhex",
  };
}
