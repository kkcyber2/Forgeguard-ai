import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Environment helpers                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`[lemonsqueezy] Missing env var: ${key}`);
  return v;
}

/** Lazy-read so the module can be imported without crashing at build time. */
export function getLSEnv() {
  return {
    apiKey:        requireEnv("LEMONSQUEEZY_API_KEY"),
    webhookSecret: requireEnv("LEMONSQUEEZY_WEBHOOK_SECRET"),
    storeId:       process.env.LEMONSQUEEZY_STORE_ID ?? "",
    // Variant IDs map: set these in your .env after creating products in LS
    variantStartup:    process.env.LEMONSQUEEZY_VARIANT_STARTUP ?? "",
    variantEnterprise: process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE ?? "",
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Plan metadata (source of truth for the UI)                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export type PlanId = "free" | "startup" | "enterprise";

export interface PlanMeta {
  id: PlanId;
  name: string;
  price: number; // USD/month (0 = free)
  scansPerMonth: number; // 999_999 = unlimited
  engine: string;
  pdfReport: boolean;
  apiAccess: boolean;
  badge?: string;
  description: string;
  features: string[];
}

export const PLANS: PlanMeta[] = [
  {
    id: "free",
    name: "Hacker",
    price: 0,
    scansPerMonth: 2,
    engine: "Llama-8B",
    pdfReport: false,
    apiAccess: false,
    description: "Explore AI red-teaming with no commitment.",
    features: [
      "2 scans / month",
      "Llama-8B attack engine",
      "Full finding breakdown",
      "OWASP LLM coverage map",
    ],
  },
  {
    id: "startup",
    name: "Startup",
    price: 19,
    scansPerMonth: 20,
    engine: "DeepSeek-V3",
    pdfReport: true,
    apiAccess: false,
    badge: "Most Popular",
    description: "For teams shipping AI products that need real security.",
    features: [
      "20 scans / month",
      "DeepSeek-V3 attack engine",
      "Full Audit Report PDF",
      "OWASP LLM coverage map",
      "Remediation roadmap",
      "Email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    scansPerMonth: 999_999,
    engine: "DeepSeek-R1 (High Reasoning)",
    pdfReport: true,
    apiAccess: true,
    description: "Unlimited power for security teams and regulated industries.",
    features: [
      "Unlimited scans",
      "DeepSeek-R1 reasoning engine",
      "Full Audit Report PDF",
      "REST API access",
      "Priority Slack support",
      "Custom attack playbooks",
      "SLA guarantee",
    ],
  },
];

export function getPlanMeta(id: PlanId): PlanMeta {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

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
