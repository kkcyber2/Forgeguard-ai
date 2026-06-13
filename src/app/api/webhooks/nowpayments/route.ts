import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { mapNowPaymentStatus } from "@/lib/payments/crypto";

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
 * NOWPayments IPN — sync crypto_deposits status; DB trigger activates subscription OR wallet credits by deposit_type.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: NowPaymentsIpnPayload;
  try {
    payload = (await req.json()) as NowPaymentsIpnPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = payload.payment_id != null ? String(payload.payment_id) : "";
  const rawStatus = payload.payment_status ?? "";

  if (!paymentId || !rawStatus) {
    return NextResponse.json({ error: "Missing payment_id or payment_status" }, { status: 400 });
  }

  const status = mapNowPaymentStatus(rawStatus);
  const admin = createAdminSupabase();

  const { data: deposit, error: fetchErr } = await admin
    .from("crypto_deposits")
    .select("id, status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[nowpayments/webhook] fetch", fetchErr.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!deposit) {
    console.warn("[nowpayments/webhook] unknown payment_id", paymentId);
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (deposit.status === status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: updateErr } = await admin
    .from("crypto_deposits")
    .update({ status })
    .eq("id", deposit.id);

  if (updateErr) {
    console.error("[nowpayments/webhook] update", updateErr.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
