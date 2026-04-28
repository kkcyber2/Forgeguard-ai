import { NextRequest, NextResponse } from "next/server";

import { handleStripeWebhook } from "@/lib/agathon/stripe_payment_bridge";

/**
 * Stripe webhook endpoint.
 *
 * Stripe POSTs every billing event to this URL. We forward the request
 * straight into `handleStripeWebhook`, which:
 *   1. Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`
 *   2. Parses the event into a typed Stripe.Event
 *   3. Dispatches to the right business-logic handler (subscription sync,
 *      invoice persistence, payment-method capture, etc.)
 *
 * Critical wiring notes:
 *
 * - Stripe verifies signatures against the **raw** request body. We MUST
 *   pass the unparsed string (or Buffer) into constructEvent — never the
 *   JSON-parsed object. `req.text()` gives us exactly that.
 *
 * - Node runtime, not edge: the Stripe SDK uses Node's crypto module for
 *   webhook signature verification. Edge runtime would silently fail.
 *
 * - We never throw 5xx for *known* bad events — that would cause Stripe to
 *   retry indefinitely. We only return 4xx for signature failures. If our
 *   downstream Supabase write fails, we log + return 500 so Stripe retries.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 },
    );
  }

  // Read the raw body verbatim. Do NOT use req.json() — signature
  // verification depends on byte-exact body matching.
  const rawBody = await req.text();

  try {
    const result = await handleStripeWebhook({ rawBody, signature });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = (err as Error).message ?? "unknown";

    // Signature failures → 400 (don't retry — the secret is misconfigured).
    if (message.includes("signature verification failed")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Missing secret → 500, but don't retry-storm Stripe.
    if (message.includes("STRIPE_WEBHOOK_SECRET is not set")) {
      console.error("[stripe:webhook]", message);
      return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
    }

    // Anything else — log loudly, let Stripe retry.
    console.error("[stripe:webhook] handler crashed:", err);
    return NextResponse.json(
      { error: "handler failed", detail: message },
      { status: 500 },
    );
  }
}

// GET responds 200 so you can paste the URL into a browser to confirm
// the route exists. Stripe never GETs the endpoint, so this is purely
// for sanity checking.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    message: "Stripe webhook endpoint is alive. POST events to this URL.",
  });
}
