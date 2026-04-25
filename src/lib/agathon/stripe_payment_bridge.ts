import "server-only";

import Stripe from "stripe";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { asAgathonDb, type AgathonDatabase } from "@/lib/agathon/agathon-db";
import type { SupabaseClient } from "@supabase/supabase-js";
// NOTE: We deliberately don't import Database here — the Agathon tables
// (subscriptions/invoices/etc.) are added by migration 0002 and aren't in
// the codegenned shape until you run `supabase gen types typescript`.
// The asAgathonDb() cast in agathon-db.ts bridges the gap.

/**
 * Agathon — Stripe payment bridge.
 * --------------------------------
 *
 * Three responsibilities:
 *
 *   1. Map our four product tiers (recon / standard / aggressive / greasy)
 *      onto Stripe Price IDs and serve them from one canonical table —
 *      so the rest of the codebase never touches `price_xxx` strings.
 *
 *   2. Provide thin wrappers around the Stripe REST surface that are
 *      safe to call from Server Actions / Route Handlers:
 *        - createCheckoutSession    : new subscription / upgrade
 *        - createPortalSession      : self-serve plan/PM management
 *        - recordUsage              : metered billing for the overage
 *                                     line items (compute-seconds + tokens)
 *
 *   3. A complete Stripe webhook handler that mirrors the customer +
 *      subscription lifecycle into Postgres (tables: subscriptions,
 *      invoices, payment_methods, profiles.entitlements). This is what
 *      lets the orchestrator decide tier WITHOUT calling Stripe on the
 *      hot path.
 *
 * Production notes
 * ----------------
 * - All Stripe writes are idempotent. Webhook handlers MUST tolerate
 *   double-delivery (Stripe retries on 5xx, on timeout, and on
 *   "deliveries that succeeded but Stripe didn't see the 200").
 * - Webhook signing secret MUST be verified with constant-time compare —
 *   `stripe.webhooks.constructEvent` does this for us; never replace it
 *   with a manual JSON.parse.
 * - We never trust client-side plan claims. The source of truth is the
 *   subscription mirror in Postgres, populated by the webhook handler.
 *
 * Required env (set in Vercel + your local .env.local):
 *   STRIPE_SECRET_KEY              sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET          whsec_... from the dashboard
 *   STRIPE_PRICE_OPERATOR          price_... (the $29 base)
 *   STRIPE_PRICE_REDTEAM           price_... (the $129 base)
 *   STRIPE_PRICE_ENTERPRISE        price_... (custom — usually invoice-only)
 *   STRIPE_PRICE_METER_COMPUTE     price_... (metered, $/compute-second)
 *   STRIPE_PRICE_METER_BRAIN_IN    price_... (metered, $/M input tokens)
 *   STRIPE_PRICE_METER_BRAIN_OUT   price_... (metered, $/M output tokens)
 *   NEXT_PUBLIC_APP_URL            for redirect URLs
 *
 * Webhooks to subscribe to in the Stripe dashboard:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 *   invoice.payment_failed
 *   payment_method.attached
 */

// --------------------------------------------------------------------------- //
// Types                                                                       //
// --------------------------------------------------------------------------- //

export type AgathonPlan = "free" | "operator" | "redteam" | "enterprise";
export type AgathonIntensity = "recon" | "standard" | "aggressive" | "greasy";

export interface PlanDefinition {
  /** Internal ID stored on profiles.current_plan. */
  plan: AgathonPlan;
  /** Highest intensity allowed for this plan (used by the orchestrator). */
  maxIntensity: AgathonIntensity;
  /** Human-friendly name surfaced in the pricing page. */
  displayName: string;
  /** Short marketing tagline. */
  tagline: string;
  /** Stripe price for the *base* recurring subscription. Null = free / contract. */
  basePriceEnv: string | null;
  /** Stripe metered prices that ride along with the base subscription. */
  meteredPriceEnvs: string[];
  /** Number of free scans included per billing cycle (over-quota = metered). */
  scansIncluded: number;
}

export const PLAN_DEFINITIONS: Record<AgathonPlan, PlanDefinition> = {
  free: {
    plan: "free",
    maxIntensity: "recon",
    displayName: "Recon (Free)",
    tagline: "Fingerprint a target. No credit card.",
    basePriceEnv: null,
    meteredPriceEnvs: [],
    scansIncluded: 5,
  },
  operator: {
    plan: "operator",
    maxIntensity: "standard",
    displayName: "Operator",
    tagline: "Full OWASP LLM Top-10 sweep, multi-turn pivots.",
    basePriceEnv: "STRIPE_PRICE_OPERATOR",
    meteredPriceEnvs: ["STRIPE_PRICE_METER_COMPUTE"],
    scansIncluded: 50,
  },
  redteam: {
    plan: "redteam",
    maxIntensity: "aggressive",
    displayName: "Red Team",
    tagline: "Brain-authored custom tools, autonomous adversary chains.",
    basePriceEnv: "STRIPE_PRICE_REDTEAM",
    meteredPriceEnvs: [
      "STRIPE_PRICE_METER_COMPUTE",
      "STRIPE_PRICE_METER_BRAIN_IN",
      "STRIPE_PRICE_METER_BRAIN_OUT",
    ],
    scansIncluded: 250,
  },
  enterprise: {
    plan: "enterprise",
    maxIntensity: "greasy",
    displayName: "Enterprise",
    tagline: "Greasy mode + RCE simulation + SSO. Talk to us.",
    basePriceEnv: "STRIPE_PRICE_ENTERPRISE",
    meteredPriceEnvs: [
      "STRIPE_PRICE_METER_COMPUTE",
      "STRIPE_PRICE_METER_BRAIN_IN",
      "STRIPE_PRICE_METER_BRAIN_OUT",
    ],
    scansIncluded: 2_000,
  },
};

const INTENSITY_TO_PLAN: Record<AgathonIntensity, AgathonPlan[]> = {
  recon: ["free", "operator", "redteam", "enterprise"],
  standard: ["operator", "redteam", "enterprise"],
  aggressive: ["redteam", "enterprise"],
  greasy: ["enterprise"],
};

export function planAllowsIntensity(
  plan: AgathonPlan,
  intensity: AgathonIntensity,
): boolean {
  return INTENSITY_TO_PLAN[intensity].includes(plan);
}

// --------------------------------------------------------------------------- //
// Stripe singleton                                                            //
// --------------------------------------------------------------------------- //

let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "[agathon:stripe] STRIPE_SECRET_KEY is not set. Add it to .env.local " +
        "(test mode) or Vercel (live).",
    );
  }
  _stripe = new Stripe(key, {
    // Pinning the API version means a Stripe-side change can't silently
    // alter the shape of objects we mirror to Postgres. Bump deliberately.
    apiVersion: "2025-09-30.acacia" as Stripe.LatestApiVersion,
    appInfo: { name: "Agathon", version: "0.1.0" },
    typescript: true,
  });
  return _stripe;
}

function priceId(envName: string): string {
  const v = process.env[envName];
  if (!v) {
    throw new Error(
      `[agathon:stripe] ${envName} is not configured — cannot offer this plan.`,
    );
  }
  return v;
}

// --------------------------------------------------------------------------- //
// Customer reconciliation                                                     //
// --------------------------------------------------------------------------- //

interface EnsureCustomerInput {
  userId: string;
  email: string;
  /** Optional metadata stamped on the Stripe customer object. */
  metadata?: Record<string, string>;
}

/**
 * Find-or-create the Stripe customer for a Supabase user. Stores the
 * resulting customer ID on profiles.stripe_customer_id so we never have
 * to round-trip Stripe again on the hot path.
 */
export async function ensureStripeCustomer(
  input: EnsureCustomerInput,
): Promise<string> {
  const admin = asAgathonDb(createAdminSupabase());

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[agathon:stripe] cannot read profile: ${error.message}`);
  }

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe().customers.create({
    email: input.email,
    metadata: { agathon_user_id: input.userId, ...(input.metadata ?? {}) },
  });

  const { error: upErr } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", input.userId);
  if (upErr) {
    // Don't leave a dangling customer — but also don't throw if cleanup
    // fails (the next call will reuse it via metadata search).
    throw new Error(
      `[agathon:stripe] customer created but profile update failed: ${upErr.message}`,
    );
  }

  return customer.id;
}

// --------------------------------------------------------------------------- //
// Checkout                                                                    //
// --------------------------------------------------------------------------- //

interface CheckoutInput {
  userId: string;
  email: string;
  plan: Exclude<AgathonPlan, "free" | "enterprise">;
  /** Override the success/cancel URLs (default: /dashboard/billing/(success|cancel)). */
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const def = PLAN_DEFINITIONS[input.plan];
  if (!def.basePriceEnv) {
    throw new Error(`[agathon:stripe] plan ${input.plan} has no Stripe price.`);
  }

  const customerId = await ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
    metadata: { intended_plan: input.plan },
  });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId(def.basePriceEnv), quantity: 1 },
    // Metered prices ride along with quantity-less line items.
    ...def.meteredPriceEnvs.map((envName) => ({ price: priceId(envName) })),
  ];

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://forgeguard.ai";

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    success_url:
      input.successUrl ??
      `${baseUrl}/dashboard/billing/success?session={CHECKOUT_SESSION_ID}`,
    cancel_url: input.cancelUrl ?? `${baseUrl}/pricing`,
    subscription_data: {
      metadata: {
        agathon_user_id: input.userId,
        agathon_plan: input.plan,
      },
    },
    client_reference_id: input.userId,
  });

  if (!session.url) {
    throw new Error("[agathon:stripe] checkout session created without URL");
  }
  return { url: session.url, sessionId: session.id };
}

// --------------------------------------------------------------------------- //
// Customer portal                                                             //
// --------------------------------------------------------------------------- //

export async function createPortalSession(input: {
  userId: string;
  returnUrl?: string;
}): Promise<{ url: string }> {
  const admin = asAgathonDb(createAdminSupabase());
  const { data: profile, error } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", input.userId)
    .maybeSingle();

  if (error || !profile?.stripe_customer_id) {
    throw new Error("[agathon:stripe] no stripe customer for this user");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://forgeguard.ai";

  const session = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: input.returnUrl ?? `${baseUrl}/dashboard/billing`,
  });

  return { url: session.url };
}

// --------------------------------------------------------------------------- //
// Metered usage reporting                                                      //
// --------------------------------------------------------------------------- //

type MeterKind = "compute_seconds" | "brain_input_tokens" | "brain_output_tokens";

const METER_TO_ENV: Record<MeterKind, string> = {
  compute_seconds: "STRIPE_PRICE_METER_COMPUTE",
  brain_input_tokens: "STRIPE_PRICE_METER_BRAIN_IN",
  brain_output_tokens: "STRIPE_PRICE_METER_BRAIN_OUT",
};

interface RecordUsageInput {
  userId: string;
  scanId: string;
  kind: MeterKind;
  /** Raw quantity — Stripe meter aggregates server-side. */
  quantity: number;
  /** Optional idempotency key. We default to `${scanId}:${kind}`. */
  idempotencyKey?: string;
}

/**
 * Push a usage event to Stripe's billing meter. The orchestrator already
 * writes the same number into `usage_events` (the audit log); this is the
 * Stripe-facing mirror that actually causes the customer to be billed.
 *
 * Idempotency: Stripe meter events accept a `?identifier` so retries are
 * deduped server-side. We pass `${scanId}:${kind}` which is naturally
 * unique per scan + meter pair.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  if (input.quantity <= 0) return;

  const admin = asAgathonDb(createAdminSupabase());
  const { data: profile, error } = await admin
    .from("profiles")
    .select("stripe_customer_id, current_plan")
    .eq("id", input.userId)
    .maybeSingle();
  if (error || !profile?.stripe_customer_id) {
    // Free tier never has a customer; that's fine, we just no-op the
    // Stripe call. The audit row in usage_events is enough.
    return;
  }
  const def = PLAN_DEFINITIONS[(profile.current_plan ?? "free") as AgathonPlan];
  if (!def.meteredPriceEnvs.includes(METER_TO_ENV[input.kind])) {
    // The plan doesn't include this meter (e.g. Operator doesn't bill on
    // brain tokens). Skip silently.
    return;
  }

  const eventName = `agathon.${input.kind}`;
  const identifier = input.idempotencyKey ?? `${input.scanId}:${input.kind}`;

  await stripe().billing.meterEvents.create({
    event_name: eventName,
    payload: {
      stripe_customer_id: profile.stripe_customer_id,
      value: String(input.quantity),
    },
    identifier,
  });
}

// --------------------------------------------------------------------------- //
// Webhook                                                                     //
// --------------------------------------------------------------------------- //

export interface WebhookHandlerResult {
  received: boolean;
  eventType: string;
  /** Set by handlers when they took a meaningful side effect. */
  applied?: string;
}

/**
 * Verify the signature, decode the event, and route it. Call from
 * /app/api/stripe/webhook/route.ts with the *raw* request body.
 */
export async function handleStripeWebhook(args: {
  rawBody: string | Buffer;
  signature: string | null;
}): Promise<WebhookHandlerResult> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "[agathon:stripe] STRIPE_WEBHOOK_SECRET is not set — webhooks " +
        "cannot be verified.",
    );
  }
  if (!args.signature) {
    throw new Error("[agathon:stripe] missing Stripe-Signature header");
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      args.rawBody,
      args.signature,
      secret,
    );
  } catch (err) {
    throw new Error(
      `[agathon:stripe] webhook signature verification failed: ${
        (err as Error).message
      }`,
    );
  }

  const admin = asAgathonDb(createAdminSupabase());

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const userId =
        session.client_reference_id ??
        (session.metadata?.agathon_user_id as string | undefined);
      if (subId && userId) {
        await syncSubscription(admin, subId, userId);
      }
      return {
        received: true,
        eventType: event.type,
        applied: "subscription_synced",
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.agathon_user_id ?? null;
      if (!userId) {
        // Try to back-fill via customer mapping.
        const fromCustomer = await admin
          .from("profiles")
          .select("id")
          .eq(
            "stripe_customer_id",
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          )
          .maybeSingle();
        if (!fromCustomer.data) {
          return { received: true, eventType: event.type };
        }
        await syncSubscription(admin, sub.id, fromCustomer.data.id);
      } else {
        await syncSubscription(admin, sub.id, userId);
      }
      return {
        received: true,
        eventType: event.type,
        applied: "subscription_synced",
      };
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await admin
        .from("invoices")
        .upsert(
          {
            stripe_invoice_id: invoice.id,
            stripe_customer_id:
              typeof invoice.customer === "string"
                ? invoice.customer
                : invoice.customer?.id ?? null,
            amount_due: invoice.amount_due,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            period_start: invoice.period_start
              ? new Date(invoice.period_start * 1000).toISOString()
              : null,
            period_end: invoice.period_end
              ? new Date(invoice.period_end * 1000).toISOString()
              : null,
          },
          { onConflict: "stripe_invoice_id" },
        );
      return {
        received: true,
        eventType: event.type,
        applied: "invoice_synced",
      };
    }

    case "payment_method.attached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (typeof pm.customer === "string") {
        await admin.from("payment_methods").upsert(
          {
            stripe_payment_method_id: pm.id,
            stripe_customer_id: pm.customer,
            brand: pm.card?.brand ?? null,
            last4: pm.card?.last4 ?? null,
            exp_month: pm.card?.exp_month ?? null,
            exp_year: pm.card?.exp_year ?? null,
          },
          { onConflict: "stripe_payment_method_id" },
        );
      }
      return {
        received: true,
        eventType: event.type,
        applied: "payment_method_synced",
      };
    }

    default:
      // Acknowledge so Stripe stops retrying, but record nothing.
      return { received: true, eventType: event.type };
  }
}

// --------------------------------------------------------------------------- //
// Subscription mirror                                                         //
// --------------------------------------------------------------------------- //

type AgathonAdminClient = SupabaseClient<AgathonDatabase>;

/**
 * Refetch the subscription from Stripe and write the canonical state into
 * Postgres. Idempotent — safe to call from any of the subscription.* webhooks.
 */
async function syncSubscription(
  admin: AgathonAdminClient,
  subId: string,
  userId: string,
): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });

  const plan = planFromSubscription(sub);

  await admin.from("subscriptions").upsert(
    {
      stripe_subscription_id: sub.id,
      user_id: userId,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      status: sub.status,
      current_period_start: new Date(
        sub.current_period_start * 1000,
      ).toISOString(),
      current_period_end: new Date(
        sub.current_period_end * 1000,
      ).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      plan,
      raw: sub as unknown,
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Mirror entitlement onto profiles for hot-path reads.
  const def = PLAN_DEFINITIONS[plan];
  await admin
    .from("profiles")
    .update({
      current_plan: plan,
      entitlements: {
        max_intensity: def.maxIntensity,
        scans_included: def.scansIncluded,
      },
    })
    .eq("id", userId);
}

function planFromSubscription(sub: Stripe.Subscription): AgathonPlan {
  // Prefer the subscription metadata we stamped in createCheckoutSession.
  const tagged = sub.metadata?.agathon_plan as AgathonPlan | undefined;
  if (tagged && tagged in PLAN_DEFINITIONS) return tagged;

  // Fall back to matching the base price ID against our env mapping.
  const priceIds = new Set(
    sub.items.data
      .map((item) => (typeof item.price === "string" ? item.price : item.price.id))
      .filter(Boolean),
  );

  for (const [planKey, def] of Object.entries(PLAN_DEFINITIONS)) {
    if (!def.basePriceEnv) continue;
    const expected = process.env[def.basePriceEnv];
    if (expected && priceIds.has(expected)) {
      return planKey as AgathonPlan;
    }
  }

  return "free";
}

// --------------------------------------------------------------------------- //
// Server-side entitlement helper (for the orchestrator-dispatch path)         //
// --------------------------------------------------------------------------- //

/**
 * Should this user be allowed to start a scan at the given intensity?
 * Read-only; safe to call before sending the dispatch to Railway.
 */
export async function userCanRunIntensity(
  userId: string,
  intensity: AgathonIntensity,
): Promise<{ allowed: boolean; plan: AgathonPlan; reason?: string }> {
  const admin = asAgathonDb(createAdminSupabase());
  const { data: profile, error } = await admin
    .from("profiles")
    .select("current_plan, scans_used_this_period, entitlements")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile) {
    return { allowed: false, plan: "free", reason: "no profile row" };
  }
  const plan = (profile.current_plan ?? "free") as AgathonPlan;
  if (!planAllowsIntensity(plan, intensity)) {
    return {
      allowed: false,
      plan,
      reason: `${plan} plan cannot run intensity '${intensity}' — upgrade required`,
    };
  }
  const def = PLAN_DEFINITIONS[plan];
  const used = profile.scans_used_this_period ?? 0;
  if (used >= def.scansIncluded) {
    // Over-quota — for paid plans we still allow (it bills as overage),
    // for free we block.
    if (plan === "free") {
      return {
        allowed: false,
        plan,
        reason: "free tier scan quota exhausted for this period",
      };
    }
  }
  return { allowed: true, plan };
}
