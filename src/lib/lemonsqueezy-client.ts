/**
 * Client-safe checkout helpers — Sovereign Vault (crypto) only.
 */

export type { PlanId, PlanMeta } from "@/lib/plans";
export { PLANS } from "@/lib/plans";

/** Marketing CTAs route to billing vault — no external Stripe/LS checkout. */
export function resolveMarketingPlanCheckout(_planId: "startup" | "enterprise"): string | null {
  return null;
}

export function getConfiguredPlanCheckouts(): {
  startup: string | null;
  sovereign: string | null;
} {
  return { startup: null, sovereign: null };
}

/** @deprecated Legacy LS variant IDs — no longer used for checkout. */
export function getLSVariantIds() {
  return { variantStartup: "", variantEnterprise: "" };
}

/** @deprecated Legacy LS checkout URL builder. */
export function buildCheckoutUrl(variantId: string, _userEmail: string, _userId: string): string {
  return `https://forgeguard.ai/dashboard/billing`;
}

/** @deprecated Legacy LS marketing checkout. */
export function buildMarketingCheckoutUrl(_variantId: string): string {
  return `/dashboard/billing`;
}
