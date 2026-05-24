export function computeTrustScore(input: {
  identityVerified?: boolean;
  domainVerified?: boolean;
  phoneVerified?: boolean;
  auditScore?: number | null;
}): number {
  let score = 0;
  if (input.identityVerified) score += 35;
  if (input.domainVerified) score += 30;
  if (input.phoneVerified) score += 15;
  if (input.auditScore != null) score += Math.round(input.auditScore * 0.2);
  return Math.min(100, score);
}
