/**
 * Client-safe LemonSqueezy helpers (no server-only, no Node crypto).
 */

export type { PlanId, PlanMeta } from "@/lib/plans";
export { PLANS } from "@/lib/plans";

const FALLBACK_VARIANT_STARTUP =
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_STARTUP ??
  process.env.LEMONSQUEEZY_VARIANT_STARTUP ??
  "";

const FALLBACK_VARIANT_ENTERPRISE =
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ENTERPRISE ??
  process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE ??
  "";

export function getLSVariantIds() {
  return {
    variantStartup: FALLBACK_VARIANT_STARTUP,
    variantEnterprise: FALLBACK_VARIANT_ENTERPRISE,
  };
}

export function buildCheckoutUrl(
  variantId: string,
  userEmail: string,
  userId: string,
): string {
  const base = `https://forgeguard.lemonsqueezy.com/buy/${variantId}`;
  const params = new URLSearchParams({
    "checkout[email]": userEmail,
    "checkout[custom][user_id]": userId,
    "checkout[success_url]": `${
      process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai"
    }/dashboard/billing?upgraded=1`,
  });
  return `${base}?${params.toString()}`;
}

/** Marketing-page checkout — variant ID only (no auth session required). */
export function buildMarketingCheckoutUrl(variantId: string): string {
  const base = `https://forgeguard.lemonsqueezy.com/buy/${variantId}`;
  const params = new URLSearchParams({
    "checkout[success_url]": `${
      process.env.NEXT_PUBLIC_APP_URL ?? "https://www.forgeguard-ai.com"
    }/auth/signup?upgraded=1`,
  });
  return `${base}?${params.toString()}`;
}

export function resolveMarketingPlanCheckout(planId: "startup" | "enterprise"): string | null {
  const { variantStartup, variantEnterprise } = getLSVariantIds();
  const variantId =
    planId === "startup"
      ? variantStartup?.trim()
      : planId === "enterprise"
        ? variantEnterprise?.trim()
        : "";
  if (!variantId) return null;
  return buildMarketingCheckoutUrl(variantId);
}
