/**
 * Lemon Squeezy checkout placeholders — swap for live variant URLs after domain verification.
 */

import type { PlanId } from "@/lib/plans";
import { buildCheckoutUrl, getLSVariantIds } from "@/lib/lemonsqueezy-client";

const PLACEHOLDER_BASE = "https://checkout.lemonsqueezy.com/placeholder";

export function getPlaceholderCheckoutUrl(planId: PlanId): string {
  return `${PLACEHOLDER_BASE}/${planId}`;
}

/**
 * Resolve checkout URL: real Lemon Squeezy when variant configured, else placeholder.
 */
export function resolveCheckoutUrl(
  planId: PlanId,
  userEmail: string,
  userId: string,
): string | null {
  if (planId === "free") return null;

  const { variantStartup, variantEnterprise } = getLSVariantIds();
  const variantId =
    planId === "startup"
      ? variantStartup
      : planId === "enterprise"
        ? variantEnterprise
        : "";

  if (variantId?.trim()) {
    return buildCheckoutUrl(variantId.trim(), userEmail, userId);
  }

  return getPlaceholderCheckoutUrl(planId);
}
