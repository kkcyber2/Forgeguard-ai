import { randomBytes } from "crypto";

export function extractTargetHost(targetUrl: string): string | null {
  try {
    return new URL(targetUrl).hostname;
  } catch {
    return null;
  }
}

export function generateOwnershipToken(): string {
  return randomBytes(16).toString("hex");
}

export async function probeOwnershipFile(
  targetUrl: string,
  token: string,
): Promise<{ verified: boolean; detail: string }> {
  let origin: string;
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    return { verified: false, detail: "Invalid target URL." };
  }

  const paths = ["/auth.txt", "/forgeguard-verify.txt", "/.well-known/forgeguard-verify.txt"];
  const expected = [`forgeguard-verify=${token}`, token];

  for (const path of paths) {
    try {
      const resp = await fetch(`${origin}${path}`, {
        method: "GET",
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!resp.ok) continue;
      const text = (await resp.text()).trim();
      if (expected.some((e) => text.includes(e))) {
        return { verified: true, detail: `Verified via ${path}` };
      }
    } catch {
      // try next path
    }
  }

  return {
    verified: false,
    detail: `Place "${token}" or "forgeguard-verify=${token}" in ${origin}/auth.txt before launching.`,
  };
}
