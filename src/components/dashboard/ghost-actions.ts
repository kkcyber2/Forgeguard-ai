"use server";

import { revalidatePath } from "next/cache";
import {
  canEnableGhostMode,
  normalizeSubscriptionTier,
} from "@/lib/access/ghost-mode";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export interface GhostModeState {
  isGhostActive: boolean;
  canGhost: boolean;
  operatorId: string;
}

async function loadGhostContext(userId: string) {
  const supabase = await createServerSupabase();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "id, hacker_rank, access_level, subscription_tier, current_plan, is_ghost_active",
    )
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return { error: profileErr?.message ?? "Profile not found." } as const;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionPlan =
    subscription?.status === "active" ||
    subscription?.status === "trialing" ||
    subscription?.status === "past_due"
      ? subscription.plan
      : null;

  const tier = normalizeSubscriptionTier(
    profile.subscription_tier,
    profile.current_plan,
    subscriptionPlan,
  );

  const canGhost = canEnableGhostMode(
    profile.hacker_rank,
    tier,
    profile.access_level,
    profile.current_plan,
    subscriptionPlan,
  );

  return {
    profile,
    canGhost,
    operatorId: userId.replace(/-/g, "").slice(0, 8).toUpperCase(),
  } as const;
}

export async function getGhostModeState(): Promise<
  GhostModeState | { error: string }
> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const ctx = await loadGhostContext(user.id);
  if ("error" in ctx) return { error: ctx.error ?? "Profile not found." };

  return {
    isGhostActive: ctx.profile.is_ghost_active ?? false,
    canGhost: ctx.canGhost,
    operatorId: ctx.operatorId,
  };
}

export async function toggleGhostMode(
  enable: boolean,
): Promise<{ ok: true; isGhostActive: boolean } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const ctx = await loadGhostContext(user.id);
  if ("error" in ctx) return { error: ctx.error ?? "Profile not found." };

  if (enable && !ctx.canGhost) {
    return {
      error: "Ghost Protocol locked. Rank 3 and Enterprise subscription required.",
    };
  }

  const supabase = await createServerSupabase();
  const nextActive = enable && ctx.canGhost;

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ is_ghost_active: nextActive })
    .eq("id", user.id);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/bazaar");
  revalidatePath("/dashboard/missions");

  return { ok: true, isGhostActive: nextActive };
}
