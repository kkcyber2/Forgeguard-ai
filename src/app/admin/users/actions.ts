"use server";

import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { PlanId } from "@/lib/plans";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const VALID_RANKS = ["RECRUIT", "HACKER", "ELITE", "TRAITOR"] as const;

async function requireSovereignAdmin() {
  const profile = await requireAdminProfile();
  if (!profile) return null;
  return profile;
}

export async function setUserRole(formData: FormData): Promise<void> {
  if (!(await requireSovereignAdmin())) return;

  const userId = formData.get("user_id") as string;
  const role = formData.get("role") as string;
  if (!userId || !["admin", "client"].includes(role)) return;

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ role: role as "admin" | "client" })
    .eq("id", userId);

  if (error) console.error("[admin/users] setUserRole:", error.message);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function setVerified(formData: FormData): Promise<void> {
  if (!(await requireSovereignAdmin())) return;

  const userId = formData.get("user_id") as string;
  const val = formData.get("is_verified") === "true";
  if (!userId) return;

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ is_verified: val })
    .eq("id", userId);

  if (error) console.error("[admin/users] setVerified:", error.message);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function setHackerRank(formData: FormData): Promise<void> {
  await setOperatorRankFromForm(formData);
}

async function setOperatorRankFromForm(
  formData: FormData,
): Promise<{ error?: string }> {
  if (!(await requireSovereignAdmin())) return { error: "Forbidden." };

  const userId = formData.get("user_id") as string;
  const rank = String(formData.get("hacker_rank") ?? "").toUpperCase();
  const accessLevelRaw = formData.get("access_level");
  const accessLevel =
    accessLevelRaw != null && accessLevelRaw !== ""
      ? Math.min(5, Math.max(1, parseInt(String(accessLevelRaw), 10) || 1))
      : null;

  if (!userId) return { error: "Missing user." };

  const admin = createAdminSupabase();
  const update: ProfileUpdate = {};

  if (rank && VALID_RANKS.includes(rank as (typeof VALID_RANKS)[number])) {
    update.hacker_rank = rank;
  }
  if (accessLevel != null) {
    update.access_level = accessLevel;
  }

  if (Object.keys(update).length === 0) {
    return { error: "Invalid rank or access level." };
  }

  const { error } = await admin.from("profiles").update(update).eq("id", userId);

  if (error) {
    console.error("[admin/users] setHackerRank:", error.message);
    return { error: error.message };
  }

  if (rank === "TRAITOR") {
    await admin.rpc("freeze_wallet", { p_user_id: userId }).then(
      () => undefined,
      (e: Error) => console.error("[admin/users] freeze_wallet:", e.message),
    );
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {};
}

export async function setOperatorRank(
  userId: string,
  hackerRank: string,
  accessLevel?: number,
): Promise<{ error?: string }> {
  const fd = new FormData();
  fd.set("user_id", userId);
  fd.set("hacker_rank", hackerRank);
  if (accessLevel != null) fd.set("access_level", String(accessLevel));
  return setOperatorRankFromForm(fd);
}

export async function banUser(userId: string): Promise<{ error?: string }> {
  if (!(await requireSovereignAdmin())) return { error: "Forbidden." };
  if (!userId) return { error: "Missing user." };

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ account_status: "banned" } as ProfileUpdate)
    .eq("id", userId);

  if (error) {
    console.error("[admin/users] banUser:", error.message);
    return { error: error.message };
  }

  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
  } catch (e) {
    console.warn("[admin/users] auth ban:", e);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {};
}

export async function activateUser(userId: string): Promise<{ error?: string }> {
  if (!(await requireSovereignAdmin())) return { error: "Forbidden." };
  if (!userId) return { error: "Missing user." };

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ account_status: "active" } as ProfileUpdate)
    .eq("id", userId);

  if (error) {
    console.error("[admin/users] activateUser:", error.message);
    return { error: error.message };
  }

  try {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  } catch (e) {
    console.warn("[admin/users] auth unban:", e);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {};
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  if (!(await requireSovereignAdmin())) return { error: "Forbidden." };
  if (!userId) return { error: "Missing user." };

  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("[admin/users] deleteUser:", error.message);
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {};
}

export async function addCredits(
  userId: string,
  amount: number,
): Promise<{ error?: string; ok?: boolean }> {
  if (!(await requireSovereignAdmin())) return { error: "Forbidden." };
  if (!userId) return { error: "Missing user." };
  const credits = Number(amount);
  if (!Number.isFinite(credits) || credits <= 0) {
    return { error: "Enter a positive credit amount." };
  }

  const admin = createAdminSupabase();
  const { error } = await admin.rpc("increment_wallet", {
    p_user_id: userId,
    p_amount: credits,
  });

  if (error) {
    console.error("[admin/users] addCredits:", error.message);
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}

export async function overrideSubscription(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const profile = await requireSovereignAdmin();
  if (!profile) return { ok: false, message: "Forbidden." };

  const targetUserId = (formData.get("user_id") as string | null)?.trim();
  const plan = (formData.get("plan") as string | null)?.trim() as PlanId;
  const days = parseInt(formData.get("days") as string, 10) || 30;

  if (!targetUserId || !["free", "startup", "enterprise"].includes(plan)) {
    return { ok: false, message: "Invalid parameters." };
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + days);

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
  revalidatePath("/admin");
  revalidatePath("/dashboard/billing");

  const planLabel =
    plan === "enterprise" ? "Enterprise" : plan === "startup" ? "Startup" : "Free";
  return {
    ok: true,
    message: `Override applied: ${planLabel} for ${days} days.`,
  };
}
