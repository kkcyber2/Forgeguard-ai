/**
 * Stripe hosted checkout links — primary payment rail (Lemon Squeezy fallback).
 *
 * Configure Payment Links in Stripe Dashboard, then set:
 *   NEXT_PUBLIC_STRIPE_CHECKOUT_STARTUP   — $49/mo Startup
 *   NEXT_PUBLIC_STRIPE_CHECKOUT_SOVEREIGN — $199/mo Sovereign (enterprise plan id)
 */

import type { PlanId } from "@/lib/plans";

export type PaidPlanId = Extract<PlanId, "startup" | "enterprise">;

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  return "";
}

/** Hosted Stripe Payment Link for marketing / billing CTAs. */
export function getStripeHostedCheckoutUrl(planId: PaidPlanId): string | null {
  if (planId === "startup") {
    const url = readEnv(
      "NEXT_PUBLIC_STRIPE_CHECKOUT_STARTUP",
      "STRIPE_CHECKOUT_STARTUP_URL",
      "STRIPE_PAYMENT_LINK_STARTUP",
    );
    return url || null;
  }
  const url = readEnv(
    "NEXT_PUBLIC_STRIPE_CHECKOUT_SOVEREIGN",
    "NEXT_PUBLIC_STRIPE_CHECKOUT_ENTERPRISE",
    "STRIPE_CHECKOUT_ENTERPRISE_URL",
    "STRIPE_CHECKOUT_SOVEREIGN_URL",
    "STRIPE_PAYMENT_LINK_ENTERPRISE",
  );
  return url || null;
}

/** Append Stripe client_reference_id for post-checkout webhook correlation. */
export function buildStripeCheckoutUrl(
  planId: PaidPlanId,
  userId?: string,
  userEmail?: string,
): string | null {
  const base = getStripeHostedCheckoutUrl(planId);
  if (!base) return null;

  try {
    const url = new URL(base);
    if (userId) {
      url.searchParams.set("client_reference_id", userId);
    }
    if (userEmail) {
      url.searchParams.set("prefilled_email", userEmail);
    }
    return url.toString();
  } catch {
    return base;
  }
}

export function isStripeCheckoutConfigured(): boolean {
  return Boolean(
    getStripeHostedCheckoutUrl("startup") ||
      getStripeHostedCheckoutUrl("enterprise"),
  );
}
