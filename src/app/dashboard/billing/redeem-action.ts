"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { PlanId } from "@/lib/plans";

export type RedeemResult =
  | { ok: true; plan: PlanId; message: string }
  | { ok: false; error: string };

export async function redeemCode(code: string): Promise<RedeemResult> {
  const raw = (code ?? "").trim().toUpperCase();
  if (!raw || raw.length < 4) {
    return { ok: false, error: "Enter a valid promo code." };
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Use admin client for all DB mutations (bypasses RLS for writes)
  const admin = createAdminSupabase();

  // ── Fetch the promo code ──────────────────────────────────────────────────
  const { data: promo, error: promoErr } = await admin
    .from("promo_codes")
    .select("id, target_plan, scans_to_add, uses_left, expires_at")
    .eq("code", raw)
    .maybeSingle();

  if (promoErr || !promo) {
    return { ok: false, error: "Invalid or expired code." };
  }
  if (promo.uses_left <= 0) {
    return { ok: false, error: "This code has already been fully redeemed." };
  }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { ok: false, error: "This code has expired." };
  }

  // ── Check for double-redemption ───────────────────────────────────────────
  const { data: existing } = await admin
    .from("redeemed_codes")
    .select("id")
    .eq("code_id", promo.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "You have already redeemed this code." };
  }

  // ── Apply reward — upsert the subscription row ────────────────────────────
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30); // 30-day access grant

  const { error: subErr } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id:                user.id,
        plan:                   promo.target_plan as PlanId,
        status:                 "active",
        scans_used_this_period: 0,          // reset quota counter
        period_ends_at:         periodEnd.toISOString(),
        ls_subscription_id:     null,
        ls_customer_id:         null,
      },
      { onConflict: "user_id" },
    );

  if (subErr) {
    console.error("[redeemCode] subscription upsert failed:", subErr.message);
    return { ok: false, error: "Redemption failed. Please try again." };
  }

  // ── Record the redemption ─────────────────────────────────────────────────
  await admin
    .from("redeemed_codes")
    .insert({ code_id: promo.id, user_id: user.id });

  // ── Decrement uses_left ───────────────────────────────────────────────────
  await admin
    .from("promo_codes")
    .update({ uses_left: promo.uses_left - 1 })
    .eq("id", promo.id);

  revalidatePath("/dashboard/billing");

  const planLabel =
    (promo.target_plan as string) === "enterprise" ? "Enterprise" : "Startup";

  return {
    ok: true,
    plan: promo.target_plan as PlanId,
    message: `Access Granted: ${planLabel} unlocked for 30 days.`,
  };
}
