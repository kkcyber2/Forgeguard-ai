"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";

export async function releaseBountyFunds(
  escrowId: string,
): Promise<{ error?: string; payout?: number; credits?: number; fee?: number; event?: string }> {
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

  const { data: rpcResult, error: rpcErr } = await db.rpc("release_kinetic_bounty", {
    p_escrow_id: escrowId,
  });

  if (rpcErr) {
    console.error("[ledger] release_kinetic_bounty failed:", rpcErr.message);
    return { error: rpcErr.message };
  }

  const result = rpcResult as {
    ok?: boolean;
    error?: string;
    payout?: number;
    credits?: number;
    platform_fee?: number;
    event?: string;
  } | null;

  if (!result?.ok) {
    return { error: result?.error ?? "Kinetic bounty release failed." };
  }

  console.info(
    "[ledger] KINETIC_BOUNTY_PAID escrow=%s payout=%s credits=%s fee=%s operator=%s",
    escrowId,
    result.payout,
    result.credits,
    result.platform_fee,
    adminProfile.email,
  );

  revalidatePath("/admin/bounties");
  revalidatePath("/admin/ledger");
  return {
    payout: result.payout,
    credits: result.credits,
    fee: result.platform_fee,
    event: result.event ?? "KINETIC_BOUNTY_PAID",
  };
}
