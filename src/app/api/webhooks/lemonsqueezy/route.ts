import { NextResponse, type NextRequest } from "next/server";
import { verifyLSWebhook, variantToPlan } from "@/lib/lemonsqueezy";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/lemonsqueezy
 * --------------------------------
 * Receives LemonSqueezy subscription lifecycle events and keeps the
 * `public.subscriptions` Supabase table in sync.
 *
 * Supported events:
 *   - subscription_created        → insert / upsert row
 *   - subscription_updated        → update plan / status
 *   - subscription_cancelled      → mark status = cancelled
 *   - subscription_expired        → mark status = expired
 *   - subscription_payment_success → reset scans_used_this_period counter
 *   - subscription_paused         → mark status = paused
 *
 * Security: every request is verified with HMAC-SHA256 over the raw body
 * using the LEMONSQUEEZY_WEBHOOK_SECRET from the env. Requests without a
 * valid signature are rejected with 401 before touching the database.
 *
 * We use the service-role Supabase client (bypasses RLS) because webhook
 * calls are not authenticated as any Supabase user.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Minimal LS payload types (we only need what we actually use)               */
/* ─────────────────────────────────────────────────────────────────────────── */

interface LSSubscriptionAttributes {
  status: string;
  variant_id: number;
  customer_id: number;
  order_id: number;
  first_subscription_item: { price_id: number } | null;
  renews_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  user_email: string;
  custom_data?: { user_id?: string };
}

interface LSWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string; // ls_subscription_id e.g. "sub_xxxxxxxxxx"
    type: string;
    attributes: LSSubscriptionAttributes;
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Handler                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  /* 1 ── Read raw body BEFORE any JSON parsing (HMAC needs exact bytes) ── */
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  if (!verifyLSWebhook(rawBody, signature)) {
    console.warn("[ls/webhook] Invalid signature — rejecting");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  /* 2 ── Parse payload ─────────────────────────────────────────────────── */
  let payload: LSWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as LSWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const { event_name, custom_data: metaCustom } = payload.meta;
  const { id: lsSubId, attributes: attr } = payload.data;

  // The user_id we embedded at checkout time via custom_data
  const userId =
    metaCustom?.user_id ??
    attr.custom_data?.user_id ??
    null;

  console.log(`[ls/webhook] event=${event_name} sub=${lsSubId} user=${userId ?? "unknown"}`);

  /* 3 ── Map LS data to our schema ────────────────────────────────────── */
  const lsVariantId  = String(attr.variant_id);
  const lsCustomerId = String(attr.customer_id);
  const lsOrderId    = String(attr.order_id);
  const plan         = variantToPlan(lsVariantId);

  // period_ends_at: prefer `renews_at` (active subs), fall back to `ends_at`
  const periodEndsAt = attr.renews_at ?? attr.ends_at ?? null;

  /* 4 ── Update Supabase (service-role bypasses RLS) ───────────────────── */
  const admin = createAdminSupabase();

  switch (event_name) {
    case "subscription_created": {
      if (!userId) {
        console.error("[ls/webhook] subscription_created missing user_id — cannot upsert");
        // Still return 200 so LS doesn't keep retrying; log for manual fix.
        return NextResponse.json({ ok: true, warning: "no_user_id" });
      }

      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id:               userId,
          plan,
          status:                attr.status,
          ls_subscription_id:    lsSubId,
          ls_customer_id:        lsCustomerId,
          ls_variant_id:         lsVariantId,
          ls_order_id:           lsOrderId,
          scans_used_this_period: 0,
          period_starts_at:      new Date().toISOString(),
          period_ends_at:        periodEndsAt,
        },
        { onConflict: "user_id" },
      );
      if (error) console.error("[ls/webhook] upsert error:", error.message);
      break;
    }

    case "subscription_updated": {
      // Find by ls_subscription_id (may or may not have user_id in meta)
      const { error } = await admin
        .from("subscriptions")
        .update({
          plan,
          status:             attr.status,
          ls_variant_id:      lsVariantId,
          period_ends_at:     periodEndsAt,
        })
        .eq("ls_subscription_id", lsSubId);
      if (error) console.error("[ls/webhook] update error:", error.message);
      break;
    }

    case "subscription_cancelled": {
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "cancelled", period_ends_at: periodEndsAt })
        .eq("ls_subscription_id", lsSubId);
      if (error) console.error("[ls/webhook] cancel error:", error.message);
      break;
    }

    case "subscription_expired": {
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "expired", plan: "free" })
        .eq("ls_subscription_id", lsSubId);
      if (error) console.error("[ls/webhook] expire error:", error.message);
      break;
    }

    case "subscription_paused": {
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "paused" })
        .eq("ls_subscription_id", lsSubId);
      if (error) console.error("[ls/webhook] pause error:", error.message);
      break;
    }

    case "subscription_payment_success": {
      // New billing period — reset the scan counter and update period dates
      const { error } = await admin
        .from("subscriptions")
        .update({
          scans_used_this_period: 0,
          period_starts_at:       new Date().toISOString(),
          period_ends_at:         periodEndsAt,
          status:                 "active",
        })
        .eq("ls_subscription_id", lsSubId);
      if (error) console.error("[ls/webhook] payment success error:", error.message);
      break;
    }

    default:
      // Unknown event — acknowledge to prevent LS retries, ignore silently.
      console.log(`[ls/webhook] Unhandled event: ${event_name}`);
  }

  return NextResponse.json({ ok: true, event: event_name });
}
