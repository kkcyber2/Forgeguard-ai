/**
 * Lemon Squeezy checkout + Bazaar purchase resolution.
 *
 * When REVENUE_SIMULATION_MODE=true, paid Bazaar scripts grant instantly
 * (no external Lemon Squeezy redirect). Subscription checkout falls back to
 * in-app billing when no variant is configured.
 */

import type { PlanId } from "@/lib/plans";
import { buildCheckoutUrl } from "@/lib/lemonsqueezy-client";

const PLACEHOLDER_BASE = "https://checkout.lemonsqueezy.com/placeholder";

const BAZAAR_VARIANT =
  process.env.LEMONSQUEEZY_VARIANT_BAZAAR ??
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_BAZAAR ??
  "";

/** True when REVENUE_SIMULATION_MODE is enabled (launch / staging without live payments). */
export function isRevenueSimulationMode(): boolean {
  const v = process.env.REVENUE_SIMULATION_MODE;
  return v === "true" || v === "1";
}

export function getPlaceholderCheckoutUrl(planId: PlanId): string {
  return `${PLACEHOLDER_BASE}/${planId}`;
}

export function getBazaarCheckoutUrl(
  scriptId: string,
  userId: string,
  priceUsd: number,
  userEmail?: string,
): string {
  const successUrl = `${
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.forgeguard-ai.com"
  }/dashboard/bazaar?purchased=1`;

  if (BAZAAR_VARIANT.trim() && userEmail?.trim()) {
    const base = buildCheckoutUrl(BAZAAR_VARIANT.trim(), userEmail.trim(), userId);
    const url = new URL(base);
    url.searchParams.set("checkout[custom][script_id]", scriptId);
    url.searchParams.set("checkout[custom][price_usd]", String(priceUsd));
    url.searchParams.set("checkout[success_url]", successUrl);
    return url.toString();
  }

  return `${PLACEHOLDER_BASE}/bazaar/${scriptId}?user=${encodeURIComponent(userId)}&price=${priceUsd}`;
}

export type BazaarCheckoutResolution =
  | { mode: "simulate" }
  | { mode: "redirect"; redirectUrl: string };

/**
 * Resolve how a paid Bazaar script should be fulfilled.
 * Simulation mode skips Lemon Squeezy and grants access in-app.
 */
export function resolveBazaarCheckout(params: {
  scriptId: string;
  userId: string;
  priceUsd: number;
  userEmail: string;
}): BazaarCheckoutResolution {
  if (isRevenueSimulationMode()) {
    return { mode: "simulate" };
  }

  return {
    mode: "redirect",
    redirectUrl: getBazaarCheckoutUrl(
      params.scriptId,
      params.userId,
      params.priceUsd,
      params.userEmail,
    ),
  };
}

/**
 * Resolve subscription checkout URL — Sovereign Vault (in-app crypto) only.
 */
export function resolveCheckoutUrl(
  planId: PlanId,
  _userEmail: string,
  _userId: string,
): string | null {
  if (planId === "free") return null;
  // Paid plans use /dashboard/billing Sovereign Vault modal — no external redirect.
  return null;
}

export type BazaarPurchaseResult = {
  ok?: boolean;
  error?: string;
  code?: string;
  redirectUrl?: string;
  already_owned?: boolean;
  simulated?: boolean;
};
