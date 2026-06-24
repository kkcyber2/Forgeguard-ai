import type { NextRequest } from "next/server";
import { getThreatScore, ipHashFromRequest } from "@/lib/perimeter/ip-blocklist";
import {
  tarpitDelayMs,
  tarpitEnabled,
  TARPIT_SCORE_THRESHOLD,
} from "@/lib/perimeter/threat-score";

/**
 * Optional tar pit — slow flagged IPs (2–5s). No payload execution, no offensive content.
 */
export async function applyTarPitIfFlagged(request: NextRequest): Promise<void> {
  if (!tarpitEnabled()) return;
  const ipHash = ipHashFromRequest(request);
  const score = await getThreatScore(ipHash);
  if (score < TARPIT_SCORE_THRESHOLD) return;
  await new Promise((resolve) => setTimeout(resolve, tarpitDelayMs()));
}
