const HACKER_RANK_TRUST: Record<string, number> = {
  RECRUIT: 1,
  HACKER: 2,
  OPERATIVE: 2,
  ELITE: 3,
  GHOST: 3,
  SENTINEL: 4,
  PHANTOM: 4,
  SOVEREIGN: 4,
  LEGEND: 5,
  TRAITOR: 0,
};

/** TopNav trust badge — tier from profile.hacker_rank only; null/undefined → 0. */
export function resolveTrustLevelFromHackerRank(
  hackerRank: string | number | null | undefined,
): number {
  if (hackerRank == null) return 0;
  if (typeof hackerRank === "number" && Number.isFinite(hackerRank)) {
    return Math.min(5, Math.max(0, Math.round(hackerRank)));
  }
  const normalized =
    typeof hackerRank === "string" ? hackerRank : String(hackerRank);
  if (normalized.trim() === "") return 0;
  return HACKER_RANK_TRUST[normalized.toUpperCase()] ?? 0;
}

export function computeTrustScore(input: {
  identityVerified?: boolean;
  domainVerified?: boolean;
  faceLivenessVerified?: boolean;
  auditScore?: number | null;
}): number {
  let score = 0;
  if (input.identityVerified) score += 35;
  if (input.domainVerified) score += 30;
  if (input.faceLivenessVerified) score += 15;
  if (input.auditScore != null) score += Math.round(input.auditScore * 0.2);
  return Math.min(100, score);
}
