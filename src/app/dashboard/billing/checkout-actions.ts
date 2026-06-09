"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { isRevenueSimulationMode } from "@/lib/payments/lemon-squeezy";
import type { PlanId } from "@/lib/plans";

export type SimulateCheckoutResult =
  | { ok: true; plan: PlanId }
  | { ok: false; error: string };

/**
 * REVENUE_SIMULATION_MODE — upsert subscription without Stripe redirect.
 */
export async function simulateSubscriptionCheckout(
  planId: Extract<PlanId, "startup" | "enterprise">,
): Promise<SimulateCheckoutResult> {
  if (!isRevenueSimulationMode()) {
    return { ok: false, error: "Revenue simulation is disabled" };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const admin = createAdminSupabase();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan: planId,
      status: "active",
      scans_used_this_period: 0,
      period_ends_at: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[billing/simulate]", error.message);
    return { ok: false, error: "Failed to update subscription" };
  }

  revalidatePath("/dashboard/billing");
  return { ok: true, plan: planId };
}
