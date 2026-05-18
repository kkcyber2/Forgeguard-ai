"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type CreatePromoResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function createPromoCode(
  formData: FormData,
): Promise<CreatePromoResult> {
  // ── Admin guard ───────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  const code = ((formData.get("code") as string) ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  const targetPlan = (formData.get("target_plan") as string) ?? "startup";
  const usesLeft = parseInt(formData.get("uses_left") as string, 10) || 1;
  const expiresStr = (formData.get("expires_at") as string | null)?.trim();

  if (!code || code.length < 4) {
    return { ok: false, error: "Code must be at least 4 characters." };
  }
  if (!["startup", "enterprise"].includes(targetPlan)) {
    return { ok: false, error: "Invalid plan." };
  }

  const expiresAt = expiresStr ? new Date(expiresStr).toISOString() : null;

  // ── Insert ────────────────────────────────────────────────────────────────
  const admin = createAdminSupabase();
  const { error } = await admin.from("promo_codes").insert({
    code,
    reward_type: "plan_upgrade",
    target_plan: targetPlan,
    scans_to_add: 1,
    uses_left: usesLeft,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { ok: false, error: "A code with that name already exists." };
    }
    console.error("[admin/promotions] createPromoCode:", error.message);
    return { ok: false, error: "Database error — try again." };
  }

  revalidatePath("/admin/promotions");
  return { ok: true, code };
}

export async function revokePromoCode(formData: FormData): Promise<void> {
  // ── Admin guard ───────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return;

  const promoId = formData.get("promo_id") as string;
  if (!promoId) return;

  const admin = createAdminSupabase();
  await admin.from("promo_codes").update({ uses_left: 0 }).eq("id", promoId);

  revalidatePath("/admin/promotions");
}
