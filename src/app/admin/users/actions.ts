"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PlanId } from "@/lib/plans";

export async function setUserRole(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  const role = formData.get("role") as string;
  if (!userId || !["admin", "client"].includes(role)) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ role: role as "admin" | "client" })
    .eq("id", userId);

  if (error) console.error("[admin/users] setUserRole:", error.message);
  revalidatePath("/admin/users");
}

export async function setVerified(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  const val = formData.get("is_verified") === "true";
  if (!userId) return;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ is_verified: val })
    .eq("id", userId);

  if (error) console.error("[admin/users] setVerified:", error.message);
  revalidatePath("/admin/users");
}

export async function setHackerRank(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  const rank   = formData.get("hacker_rank") as string;
  if (!userId || rank !== "TRAITOR") return;

  const admin = createAdminSupabase();

  // Stamp hacker_rank in profiles
  const { error } = await admin
    .from("profiles")
    .update({ hacker_rank: "TRAITOR" })
    .eq("id", userId);

  if (error) console.error("[admin/users] setHackerRank:", error.message);

  // Freeze wallet via SECURITY DEFINER RPC (mirrors Traitor Protocol)
  await admin.rpc("freeze_wallet", { target_user_id: userId }).catch((e: Error) =>
    console.error("[admin/users] freeze_wallet:", e.message),
  );

  revalidatePath("/admin/users");
}

export async function overrideSubscription(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  // ── Caller must be admin ──────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, message: "Forbidden." };
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  const targetUserId = (formData.get("user_id") as string | null)?.trim();
  const plan = (formData.get("plan") as string | null)?.trim() as PlanId;
  const days = parseInt(formData.get("days") as string, 10) || 30;

  if (!targetUserId || !["free", "startup", "enterprise"].includes(plan)) {
    return { ok: false, message: "Invalid parameters." };
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + days);

  // ── Upsert subscription ───────────────────────────────────────────────────
  const admin = createAdminSupabase();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: targetUserId,
      plan,
      status: "active",
      scans_used_this_period: 0,
      period_ends_at: periodEnd.toISOString(),
      ls_subscription_id: null,
      ls_customer_id: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[admin/users] overrideSubscription:", error.message);
    return { ok: false, message: "Database error — try again." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard/billing");

  const planLabel =
    plan === "enterprise" ? "Enterprise" : plan === "startup" ? "Startup" : "Free";
  return {
    ok: true,
    message: `Override applied: ${planLabel} for ${days} days.`,
  };
}
