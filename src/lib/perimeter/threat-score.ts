/**
 * Threat scoring thresholds for legal perimeter defense.
 */

export const THREAT_DELTAS = {
  honeypot: 50,
  scraper: 20,
  rate_limit: 15,
  webhook: 100,
  sovereign: 30,
} as const;

export const AUTO_BLOCK_SCORE = 80;
export const TARPIT_SCORE_THRESHOLD = 40;

export const DEFAULT_BLOCK_TTL_SEC = 24 * 60 * 60;
export const THREAT_SCORE_WINDOW_SEC = 24 * 60 * 60;

export function threatDeltaForReason(reason: string): number {
  const r = reason.toLowerCase();
  if (r.includes("honeypot") || r.includes("kinetic")) return THREAT_DELTAS.honeypot;
  if (r.includes("webhook")) return THREAT_DELTAS.webhook;
  if (r.includes("sovereign")) return THREAT_DELTAS.sovereign;
  if (r.includes("rate_limit") || r.includes("burst")) return THREAT_DELTAS.rate_limit;
  if (r.includes("scraper") || r.includes("pow")) return THREAT_DELTAS.scraper;
  return THREAT_DELTAS.scraper;
}

export function blockTtlSec(): number {
  const raw = process.env.FORTRESS_BLOCK_TTL_SEC?.trim();
  if (!raw) return DEFAULT_BLOCK_TTL_SEC;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BLOCK_TTL_SEC;
}

export function tarpitEnabled(): boolean {
  return process.env.FORTRESS_TARPIT !== "0";
}

export function tarpitDelayMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}
