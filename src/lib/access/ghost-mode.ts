/**
 * Ghost Protocol — elite hacker stealth identity masking.
 * Gate: hacker rank tier ≥ 3 AND subscription_tier = enterprise.
 */

import { normalizeHackerRankLabel } from "@/lib/access/ranks";

export const GHOST_ACCENT = {
  primary: "#4A4A4A",
  glow: "rgba(74,74,74,0.35)",
  label: "Ghost Operator",
} as const;

export const GHOST_LOCK_TOOLTIP = "Required: Rank 3 & Enterprise Subscription";

const RANK_TIER: Record<string, number> = {
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

export function resolveHackerRankTier(
  hackerRank: string | number | null | undefined,
  accessLevel: number | null | undefined,
): number {
  if (typeof hackerRank === "number" && Number.isFinite(hackerRank)) {
    const fromNumeric = Math.min(5, Math.max(0, Math.round(hackerRank)));
    const fromLevel =
      accessLevel != null ? Math.max(1, Math.min(5, accessLevel)) : 0;
    return Math.max(fromNumeric, fromLevel);
  }
  const fromRank = RANK_TIER[normalizeHackerRankLabel(hackerRank, "")] ?? 0;
  const fromLevel =
    accessLevel != null ? Math.max(1, Math.min(5, accessLevel)) : 0;
  return Math.max(fromRank, fromLevel);
}

export function normalizeSubscriptionTier(
  subscriptionTier: string | null | undefined,
  currentPlan: string | null | undefined,
  subscriptionPlan?: string | null,
): string {
  const raw =
    subscriptionTier ??
    currentPlan ??
    subscriptionPlan ??
    "free";
  return raw.toLowerCase();
}

export function canEnableGhostMode(
  hackerRank: string | number | null | undefined,
  subscriptionTier: string | null | undefined,
  accessLevel?: number | null,
  currentPlan?: string | null,
  subscriptionPlan?: string | null,
): boolean {
  const tier = resolveHackerRankTier(hackerRank, accessLevel ?? null);
  const plan = normalizeSubscriptionTier(
    subscriptionTier,
    currentPlan,
    subscriptionPlan,
  );
  return tier >= 3 && plan === "enterprise";
}

export function operatorAlias(userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `OPERATOR_${short}`;
}

export interface GhostMaskedAuthor {
  id: string;
  display_name: string;
  is_ghost: true;
  hacker_rank: string | null;
}

export function maskAuthorIfGhost(
  authorId: string,
  isGhostActive: boolean | null | undefined,
  hackerRank: string | null | undefined,
): GhostMaskedAuthor | null {
  if (!isGhostActive) return null;
  return {
    id: authorId,
    display_name: operatorAlias(authorId),
    is_ghost: true,
    hacker_rank: hackerRank ?? null,
  };
}

export function resolvePublicDisplayName(
  userId: string,
  displayName: string | null | undefined,
  isGhostActive: boolean | null | undefined,
  hackerRank: string | null | undefined,
): string {
  const ghost = maskAuthorIfGhost(userId, isGhostActive, hackerRank);
  if (ghost) return ghost.display_name;
  return displayName?.trim() || operatorAlias(userId);
}

export const SOVEREIGN_VERIFIED_LABEL = "Verified by ForgeGuard Sovereign";
