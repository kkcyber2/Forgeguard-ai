/**
 * Hashed IP blocklist — Supabase source of truth + Upstash/in-memory edge cache.
 */

import type { NextRequest } from "next/server";
import { hashIpAddress } from "@/lib/live-map/geo";
import {
  clearUpstashBlock,
  getUpstashThreatScore,
  incrementUpstashThreatScore,
  isUpstashBlocked,
  setUpstashBlock,
} from "@/lib/perimeter/upstash-perimeter";
import {
  AUTO_BLOCK_SCORE,
  blockTtlSec,
  THREAT_SCORE_WINDOW_SEC,
} from "@/lib/perimeter/threat-score";

interface MemoryBlock {
  expiresAt: number;
}

const memoryBlocks = new Map<string, MemoryBlock>();
const memoryScores = new Map<string, { score: number; expiresAt: number }>();

function pruneMemory(): void {
  const now = Date.now();
  for (const [k, v] of memoryBlocks) {
    if (v.expiresAt <= now) memoryBlocks.delete(k);
  }
  for (const [k, v] of memoryScores) {
    if (v.expiresAt <= now) memoryScores.delete(k);
  }
}

function memoryIsBlocked(ipHash: string): boolean {
  pruneMemory();
  const entry = memoryBlocks.get(ipHash);
  return Boolean(entry && entry.expiresAt > Date.now());
}

function memorySetBlock(ipHash: string, ttlSec: number): void {
  memoryBlocks.set(ipHash, { expiresAt: Date.now() + ttlSec * 1000 });
}

function memoryIncrScore(ipHash: string, delta: number): number {
  pruneMemory();
  const now = Date.now();
  const windowMs = THREAT_SCORE_WINDOW_SEC * 1000;
  const existing = memoryScores.get(ipHash);
  if (!existing || existing.expiresAt <= now) {
    const score = delta;
    memoryScores.set(ipHash, { score, expiresAt: now + windowMs });
    return score;
  }
  existing.score += delta;
  return existing.score;
}

function memoryGetScore(ipHash: string): number {
  pruneMemory();
  const existing = memoryScores.get(ipHash);
  if (!existing || existing.expiresAt <= Date.now()) return 0;
  return existing.score;
}

export function ipHashFromRequest(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return hashIpAddress(ip);
}

export async function isIpBlocked(ipHash: string): Promise<boolean> {
  const upstash = await isUpstashBlocked(ipHash);
  if (upstash === true) return true;
  if (upstash === false) return memoryIsBlocked(ipHash);
  return memoryIsBlocked(ipHash);
}

export async function getThreatScore(ipHash: string): Promise<number> {
  const upstash = await getUpstashThreatScore(ipHash);
  if (upstash !== null) return upstash;
  return memoryGetScore(ipHash);
}

export async function incrementThreatScore(
  ipHash: string,
  delta: number,
): Promise<number> {
  const upstash = await incrementUpstashThreatScore(
    ipHash,
    delta,
    THREAT_SCORE_WINDOW_SEC,
  );
  if (upstash !== null) return upstash;
  return memoryIncrScore(ipHash, delta);
}

export interface BlockIpInput {
  ipHash: string;
  reason: string;
  threatScore: number;
  geoCountry?: string | null;
  ttlSec?: number;
}

/**
 * Persist block to Supabase + Upstash + in-memory (fire-and-forget from Edge).
 */
export function persistIpBlock(input: BlockIpInput): void {
  const ttlSec = input.ttlSec ?? blockTtlSec();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

  memorySetBlock(input.ipHash, ttlSec);
  void setUpstashBlock(input.ipHash, ttlSec);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  void fetch(`${url}/rest/v1/perimeter_ip_blocklist`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ip_hash: input.ipHash,
      reason: input.reason,
      threat_score: input.threatScore,
      expires_at: expiresAt,
      geo_country: input.geoCountry ?? null,
    }),
  }).catch(() => {
    /* never block edge */
  });
}

export async function maybeAutoBlock(
  ipHash: string,
  reason: string,
  score: number,
  geoCountry?: string | null,
): Promise<void> {
  if (score < AUTO_BLOCK_SCORE) return;
  persistIpBlock({
    ipHash,
    reason: `auto_block:${reason}`,
    threatScore: score,
    geoCountry,
  });
}

export function clearMemoryBlock(ipHash: string): void {
  memoryBlocks.delete(ipHash);
  memoryScores.delete(ipHash);
}

export async function clearDistributedBlock(ipHash: string): Promise<void> {
  clearMemoryBlock(ipHash);
  await clearUpstashBlock(ipHash);
}
