/**
 * POST /api/bazaar/purchase
 * ─────────────────────────────────────────────────────────────────────────────
 * Hacker Bazaar — Purchase a Script
 *
 * Flow:
 *   1. Auth guard
 *   2. Load script (must be published + cleared)
 *   3. Check buyer hasn't already purchased
 *   4. If free → grant immediately
 *   5. If paid:
 *      a. Load buyer's wallet balance
 *      b. Debit buyer_wallet, credit author_wallet
 *      c. Create bounty_escrow record (held → released atomically)
 *      d. Insert bazaar_purchases row
 *      e. Increment script.purchase_count + revenue_usd
 *   6. Return the full script code to the buyer
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PurchaseSchema = z.object({
  script_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "script_id is required" }, { status: 400 });
  }

  const { script_id } = parsed.data;

  // ── Load script ────────────────────────────────────────────────────────────
  const { data: script } = await supabase
    .from("bazaar_scripts")
    .select("id, name, author_id, code, price_usd, is_published, is_removed, audit_verdict")
    .eq("id", script_id)
    .single();

  if (!script || !script.is_published || script.is_removed || script.audit_verdict !== "cleared") {
    return NextResponse.json({ ok: false, error: "Script not available" }, { status: 404 });
  }

  if (script.author_id === user.id) {
    // Author always has access to their own code
    return NextResponse.json({ ok: true, code: script.code, owned: true });
  }

  // ── Check existing purchase ────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("bazaar_purchases")
    .select("id")
    .eq("script_id", script_id)
    .eq("buyer_id",  user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, code: script.code, already_owned: true });
  }

  const priceUsd = Number(script.price_usd);

  // ── Free script ────────────────────────────────────────────────────────────
  if (priceUsd === 0) {
    await supabase.from("bazaar_purchases").insert({
      script_id,
      buyer_id:  user.id,
      author_id: script.author_id,
      amount_usd: 0,
    });

    const adminFree = createAdminSupabase();
    await adminFree.rpc("increment_purchase", { p_script_id: script_id, p_revenue: 0 });

    return NextResponse.json({ ok: true, code: script.code });
  }

  // ── Paid script — wallet debit/credit ──────────────────────────────────────

  // Ensure buyer wallet exists
  await supabase
    .from("user_wallets")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  const { data: buyerWallet } = await supabase
    .from("user_wallets")
    .select("balance_usd")
    .eq("user_id", user.id)
    .single();

  const balance = Number(buyerWallet?.balance_usd ?? 0);
  if (balance < priceUsd) {
    return NextResponse.json(
      { ok: false, error: `Insufficient funds. Balance: $${balance.toFixed(2)}, Price: $${priceUsd.toFixed(2)}`, code: "INSUFFICIENT_FUNDS" },
      { status: 402 },
    );
  }

  // Debit buyer atomically via service-role RPC (never expose to anon client)
  const admin = createAdminSupabase();
  const { error: debitErr } = await admin.rpc("increment_wallet", {
    p_user_id: user.id,
    p_amount: -priceUsd,
  });

  if (debitErr) {
    return NextResponse.json({ ok: false, error: "Payment processing failed" }, { status: 500 });
  }

  const platformFee = Math.round(priceUsd * 0.10 * 100) / 100;
  const authorPayout = Math.round((priceUsd - platformFee) * 100) / 100;

  await admin.from("user_wallets").upsert({ user_id: script.author_id }, { onConflict: "user_id" });
  await admin.rpc("increment_wallet", {
    p_user_id: script.author_id,
    p_amount: authorPayout,
  });

  // Escrow record (already released — instant commerce)
  await supabase.from("bounty_escrow").insert({
    submission_id: script_id,  // soft ref to script
    user_id:       script.author_id,
    amount_usd:    priceUsd,
    status:        "released",
    released_at:   new Date().toISOString(),
    release_note:  `Bazaar purchase by ${user.id}`,
    processor:     "manual",
  });

  await createAdminSupabase().from("platform_transactions").insert({
    buyer_id: user.id,
    seller_id: script.author_id,
    script_id,
    amount_usd: priceUsd,
    platform_fee: platformFee,
    author_payout: authorPayout,
    tx_type: "bazaar_purchase",
  });

  // Purchase record
  await supabase.from("bazaar_purchases").insert({
    script_id,
    buyer_id:   user.id,
    author_id:  script.author_id,
    amount_usd: priceUsd,
  });

  // Update script stats atomically via RPC (concurrent-safe, service role only)
  await admin.rpc("increment_purchase", { p_script_id: script_id, p_revenue: priceUsd });

  return NextResponse.json({
    ok:           true,
    code:         script.code,
    spent:        priceUsd,
    platform_fee: platformFee,
    author_payout: authorPayout,
    new_balance:  Math.round((balance - priceUsd) * 100) / 100,
  });
}
