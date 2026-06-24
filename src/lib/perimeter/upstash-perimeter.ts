/**
 * Upstash helpers for distributed IP block + threat score (Edge-safe REST).
 */

function upstashEnv(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

function blockKey(ipHash: string): string {
  return `fg:block:${ipHash}`;
}

function scoreKey(ipHash: string): string {
  return `fg:threat:${ipHash}`;
}

async function upstashGet(key: string): Promise<string | null> {
  const env = upstashEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.baseUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    return body.result ?? null;
  } catch {
    return null;
  }
}

async function upstashSetEx(key: string, value: string, ttlSec: number): Promise<void> {
  const env = upstashEnv();
  if (!env) return;
  try {
    await fetch(
      `${env.baseUrl}/setex/${encodeURIComponent(key)}/${ttlSec}/${encodeURIComponent(value)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.token}` },
        cache: "no-store",
      },
    );
  } catch {
    /* edge-safe */
  }
}

async function upstashIncrWithTtl(key: string, ttlSec: number): Promise<number | null> {
  const env = upstashEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.baseUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["TTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown[] };
    const count = Number(body.result?.[0] ?? 0);
    const ttl = Number(body.result?.[1] ?? -1);
    if (count === 1 || ttl === -1) {
      await fetch(`${env.baseUrl}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.token}` },
        cache: "no-store",
      }).catch(() => {});
    }
    return count;
  } catch {
    return null;
  }
}

export async function isUpstashBlocked(ipHash: string): Promise<boolean | null> {
  const val = await upstashGet(blockKey(ipHash));
  if (val === null) return null;
  return val === "1";
}

export async function setUpstashBlock(ipHash: string, ttlSec: number): Promise<void> {
  await upstashSetEx(blockKey(ipHash), "1", ttlSec);
}

export async function clearUpstashBlock(ipHash: string): Promise<void> {
  const env = upstashEnv();
  if (!env) return;
  try {
    await fetch(`${env.baseUrl}/del/${encodeURIComponent(blockKey(ipHash))}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
  } catch {
    /* edge-safe */
  }
}

export async function incrementUpstashThreatScore(
  ipHash: string,
  delta: number,
  windowSec: number,
): Promise<number | null> {
  if (delta <= 0) return await getUpstashThreatScore(ipHash);
  const env = upstashEnv();
  if (!env) return null;

  const key = scoreKey(ipHash);
  try {
    for (let i = 0; i < delta; i++) {
      const count = await upstashIncrWithTtl(key, windowSec);
      if (count === null) return null;
      if (i === delta - 1) return count;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getUpstashThreatScore(ipHash: string): Promise<number | null> {
  const val = await upstashGet(scoreKey(ipHash));
  if (val === null) return null;
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : 0;
}
