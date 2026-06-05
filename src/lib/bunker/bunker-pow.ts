/**
 * Bunker CPU-stress PoW — 100 sequential SHA-256 rounds.
 */

export const BUNKER_POW_ROUNDS = 100;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Run 100 sequential SHA-256 hashes (high CPU load for simple bots). */
export async function runBunkerPowChain(seed: string, rounds = BUNKER_POW_ROUNDS): Promise<string> {
  const enc = new TextEncoder();
  let current = seed;
  for (let i = 0; i < rounds; i++) {
    const data = enc.encode(`${current}:${i}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    current = bytesToHex(digest);
  }
  return current;
}

export async function verifyBunkerPowChain(
  seed: string,
  expectedFinal: string,
  rounds = BUNKER_POW_ROUNDS,
): Promise<boolean> {
  const computed = await runBunkerPowChain(seed, rounds);
  return computed === expectedFinal.toLowerCase();
}
