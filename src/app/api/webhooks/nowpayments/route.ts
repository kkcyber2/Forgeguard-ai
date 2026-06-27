import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  grantConfirmedCryptoDeposit,
  mapNowPaymentStatus,
  verifyNowPaymentsIpnSignature,
} from "@/lib/payments/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NowPaymentsIpnPayload {
  payment_id?: string | number;
  payment_status?: string;
  order_id?: string;
  pay_address?: string;
}

/**
 * POST /api/webhooks/nowpayments
 * NOWPayments IPN — HMAC-SHA512 verified; grants subscription OR wallet by deposit_type.
 * Invoice-flow IPNs carry our order_id, so we match by order_id first
 * (fallback to payment_id for legacy white-label deposits).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig");

  if (!verifyNowPaymentsIpnSignature(rawBody, signature)) {
    console.warn("[nowpayments/webhook] invalid IPN signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: NowPaymentsIpnPayload;
  try {
    payload = JSON.parse(rawBody) as NowPaymentsIpnPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = payload.payment_id != null ? String(payload.payment_id) : "";
  const orderId = payload.order_id?.trim() ?? "";
  const rawStatus = payload.payment_status ?? "";

  if ((!paymentId && !orderId) || !rawStatus) {
    return NextResponse.json({ error: "Missing payment_id/order_id or payment_status" }, { status: 400 });
  }

  const status = mapNowPaymentStatus(rawStatus);
  const admin = createAdminSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let depositQuery: any = (admin as any)
    .from("crypto_deposits")
    .select("id, status, deposit_type");

  let deposit: { id: string; status: string; deposit_type: string | null } | null = null;
  let fetchErr: { message: string } | null = null;

  if (orderId) {
    const res = await depositQuery.eq("order_id", orderId).maybeSingle();
    fetchErr = res.error;
    deposit = res.data;
  }

  if (!deposit && paymentId) {
    const res = await (admin as any)
      .from("crypto_deposits")
      .select("id, status, deposit_type")
      .eq("payment_id", paymentId)
      .maybeSingle();
    fetchErr = res.error;
    deposit = res.data;
  }

  if (fetchErr) {
    console.error("[nowpayments/webhook] fetch", fetchErr.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!deposit) {
    console.warn("[nowpayments/webhook] unknown order_id/payment_id", { orderId, paymentId });
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (deposit.status !== status) {
    const { error: updateErr } = await admin
      .from("crypto_deposits")
      .update({ status })
      .eq("id", deposit.id);

    if (updateErr) {
      console.error("[nowpayments/webhook] update", updateErr.message);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  if (status === "confirmed") {
    const grant = await grantConfirmedCryptoDeposit(admin, deposit.id);
    if (!grant.ok) {
      console.error("[nowpayments/webhook] grant", grant.error);
      return NextResponse.json({ error: "Grant failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, status });
}
