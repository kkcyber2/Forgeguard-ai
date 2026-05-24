"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";

export async function releaseBountyFunds(
  escrowId: string,
): Promise<{ error?: string }> {
  const adminProfile = await requireAdminProfile();
  if (!adminProfile) return { error: "Unauthorized." };

  const db = createAdminSupabase();

  const { data: escrow } = await db
    .from("bounty_escrow")
    .select("id, user_id, amount_usd, status, submission_id")
    .eq("id", escrowId)
    .single();

  if (!escrow) return { error: "Escrow not found." };
  if (escrow.status !== "held") return { error: "Escrow is not in held status." };

  const amount = Number(escrow.amount_usd);
  const hackerId = escrow.user_id;

  await db.from("user_wallets").upsert({ user_id: hackerId }, { onConflict: "user_id" });

  const { error: creditErr } = await db.rpc("increment_wallet", {
    p_user_id: hackerId,
    p_amount: amount,
  });
  if (creditErr) return { error: creditErr.message };

  await db
    .from("bounty_escrow")
    .update({
      status: "released",
      released_at: new Date().toISOString(),
      release_note: `Admin release by ${adminProfile.email}`,
    })
    .eq("id", escrowId);

  await db.from("platform_transactions").insert({
    seller_id: hackerId,
    amount_usd: amount,
    amount_credits: Math.round(amount),
    author_payout: amount,
    platform_fee: 0,
    tx_type: "bounty_release",
  });

  revalidatePath("/admin/bounties");
  revalidatePath("/admin/ledger");
  return {};
}
