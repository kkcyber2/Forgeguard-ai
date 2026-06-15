/**
 * Optional distributed rate limit via Upstash Redis REST API.
 * Returns null when env is unset (caller should fall back to in-memory limiter).
 */

export async function checkUpstashRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<boolean | null> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  const redisKey = `fg:rl:${key}`;

  try {
    const res = await fetch(`${baseUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["TTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { result?: unknown[] };
    const count = Number(body.result?.[0] ?? 0);
    const ttl = Number(body.result?.[1] ?? -1);

    if (count === 1 || ttl === -1) {
      await fetch(`${baseUrl}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => {});
    }

    return count > max;
  } catch {
    return null;
  }
}

export function upstashRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}
