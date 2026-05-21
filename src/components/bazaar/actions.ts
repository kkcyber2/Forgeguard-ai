"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export async function purchaseScript(
  scriptId: string,
): Promise<{
  error?: string;
  code?: string;
  ok?: boolean;
  code?: string;
  spent?: number;
  platform_fee?: number;
  author_payout?: number;
  new_balance?: number;
}> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const { data: script } = await supabase
    .from("bazaar_scripts")
    .select("id, name, author_id, code, price_usd, is_published, is_removed, audit_verdict")
    .eq("id", scriptId)
    .single();

  if (!script || !script.is_published || script.is_removed || script.audit_verdict !== "cleared") {
    return { error: "Script not available" };
  }

  if (script.author_id === user.id) {
    return { ok: true, code: script.code };
  }

  const { data: existing } = await supabase
    .from("bazaar_purchases")
    .select("id")
    .eq("script_id", scriptId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existing) return { ok: true, code: script.code };

  const priceUsd = Number(script.price_usd);

  if (priceUsd === 0) {
    await supabase.from("bazaar_purchases").insert({
      script_id: scriptId,
      buyer_id: user.id,
      author_id: script.author_id,
      amount_usd: 0,
    });
    await supabase.rpc("increment_purchase", { p_script_id: scriptId, p_revenue: 0 });
    revalidatePath("/dashboard/bazaar");
    return { ok: true, spent: 0, code: script.code };
  }

  await supabase.from("user_wallets").upsert({ user_id: user.id }, { onConflict: "user_id" });

  const { data: buyerWallet } = await supabase
    .from("user_wallets")
    .select("balance_usd, is_frozen")
    .eq("user_id", user.id)
    .single();

  if (buyerWallet?.is_frozen) {
    return { error: "Wallet frozen.", code: "WALLET_FROZEN" };
  }

  const balance = Number(buyerWallet?.balance_usd ?? 0);
  if (balance < priceUsd) {
    return {
      error: `Insufficient funds. Balance: $${balance.toFixed(2)}, Price: $${priceUsd.toFixed(2)}`,
      code: "INSUFFICIENT_FUNDS",
    };
  }

  const platformFee = Math.round(priceUsd * 0.1 * 100) / 100;
  const authorPayout = Math.round((priceUsd - platformFee) * 100) / 100;

  const { error: debitErr } = await supabase.rpc("increment_wallet", {
    p_user_id: user.id,
    p_amount: -priceUsd,
  });
  if (debitErr) return { error: "Payment processing failed" };

  await supabase.from("user_wallets").upsert(
    { user_id: script.author_id },
    { onConflict: "user_id" },
  );
  await supabase.rpc("increment_wallet", {
    p_user_id: script.author_id,
    p_amount: authorPayout,
  });

  await admin.from("platform_transactions").insert({
    buyer_id: user.id,
    seller_id: script.author_id,
    script_id: scriptId,
    amount_usd: priceUsd,
    platform_fee: platformFee,
    author_payout: authorPayout,
    tx_type: "bazaar_purchase",
  });

  await supabase.from("bazaar_purchases").insert({
    script_id: scriptId,
    buyer_id: user.id,
    author_id: script.author_id,
    amount_usd: priceUsd,
  });

  await supabase.rpc("increment_purchase", {
    p_script_id: scriptId,
    p_revenue: priceUsd,
  });

  revalidatePath("/dashboard/bazaar");
  return {
    ok: true,
    code: script.code,
    spent: priceUsd,
    platform_fee: platformFee,
    author_payout: authorPayout,
    new_balance: Math.round((balance - priceUsd) * 100) / 100,
  };
}
