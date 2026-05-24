import "server-only";

import type { PlanId } from "@/lib/plans";

import { createHmac, timingSafeEqual } from "crypto";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Environment helpers                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`[lemonsqueezy] Missing env var: ${key}`);
  return v;
}

/**
 * Hardcoded fallback variant IDs.
 * These are used when env vars are not set (e.g., during local dev or
 * if Vercel env vars haven't been configured yet).
 * Replace these with your actual LemonSqueezy variant IDs from:
 * https://app.lemonsqueezy.com/products
 *
 * To find your variant IDs:
 *   1. Go to LemonSqueezy → Products
 *   2. Click a product → Variants tab
 *   3. Copy the numeric ID from the URL or the variant row
 */
const FALLBACK_VARIANT_STARTUP    = process.env.LEMONSQUEEZY_VARIANT_STARTUP    ?? "";
const FALLBACK_VARIANT_ENTERPRISE = process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE ?? "";

/**
 * Read variant IDs only — does NOT require the API key.
 * Safe to call even when LS credentials aren't configured.
 * Used by billing page checkout URL builder.
 */
export function getLSVariantIds() {
  return {
    variantStartup:    FALLBACK_VARIANT_STARTUP,
    variantEnterprise: FALLBACK_VARIANT_ENTERPRISE,
  };
}

/** Lazy-read so the module can be imported without crashing at build time. */
export function getLSEnv() {
  return {
    apiKey:        requireEnv("LEMONSQUEEZY_API_KEY"),
    webhookSecret: requireEnv("LEMONSQUEEZY_WEBHOOK_SECRET"),
    storeId:       process.env.LEMONSQUEEZY_STORE_ID ?? "",
    // Variant IDs — set in .env after creating products in LemonSqueezy:
    //   Startup    → $49/mo  → LEMONSQUEEZY_VARIANT_STARTUP
    //   Enterprise → $199/mo → LEMONSQUEEZY_VARIANT_ENTERPRISE
    variantStartup:    FALLBACK_VARIANT_STARTUP,
    variantEnterprise: FALLBACK_VARIANT_ENTERPRISE,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Plan metadata (source of truth for the UI)                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

// Re-export from client-safe module so server-side code can still
// import PlanMeta/PLANS from here without duplication.
export type { PlanId, PlanMeta } from "@/lib/plans";
export { PLANS, getPlanMeta as _getPlanMeta } from "@/lib/plans";


/* ─────────────────────────────────────────────────────────────────────────── */
/*  Webhook signature verification                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Verifies the X-Signature header that LemonSqueezy attaches to every
 * outgoing webhook. Uses HMAC-SHA256 and a timing-safe comparison to prevent
 * timing attacks.
 *
 * @param rawBody   The raw request body buffer (do NOT parse JSON first).
 * @param signature The value of the `X-Signature` request header.
 * @returns         `true` if the signature is valid.
 */
export function verifyLSWebhook(rawBody: Buffer, signature: string): boolean {
  try {
    const { webhookSecret } = getLSEnv();
    const expected = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const signatureBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LemonSqueezy REST API helpers                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

const LS_API = "https://api.lemonsqueezy.com/v1";

async function lsFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const { apiKey } = getLSEnv();
  const res = await fetch(`${LS_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[lemonsqueezy] ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as T;
}

/** Cancel a subscription by its LemonSqueezy subscription ID. */
export async function cancelSubscription(
  lsSubscriptionId: string,
): Promise<void> {
  await lsFetch(`/subscriptions/${lsSubscriptionId}`, { method: "DELETE" });
}

/** Generate a customer-portal URL so users can manage billing themselves. */
export async function getCustomerPortalUrl(
  lsCustomerId: string,
): Promise<string | null> {
  try {
    type PortalResp = { data: { attributes: { urls: { customer_portal: string } } } };
    const json = await lsFetch<PortalResp>(`/customers/${lsCustomerId}`);
    return json.data.attributes.urls.customer_portal ?? null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Variant → Plan mapping                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Maps a LemonSqueezy variant ID to a plan slug.
 * Falls back to "free" if the variant is unknown (safety net).
 */
export function variantToPlan(variantId: string): PlanId {
  const env = getLSEnv();
  if (variantId === env.variantEnterprise) return "enterprise";
  if (variantId === env.variantStartup)    return "startup";
  return "free";
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Checkout URL builder                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Builds a LemonSqueezy hosted checkout URL for the given variant,
 * pre-filled with the user's email so they don't have to type it twice.
 */
export function buildCheckoutUrl(
  variantId: string,
  userEmail: string,
  userId: string,
): string {
  const base = `https://forgeguard.lemonsqueezy.com/buy/${variantId}`;
  const params = new URLSearchParams({
    "checkout[email]":                      userEmail,
    "checkout[custom][user_id]":            userId,
    "checkout[success_url]":                `${process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai"}/dashboard/billing?upgraded=1`,
  });
  return `${base}?${params.toString()}`;
}
