"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, requireAdminProfile } from "@/lib/supabase/server";

async function adminGuard() {
  const admin = await requireAdminProfile();
  if (!admin) return null;
  const supabase = await createServerSupabase();
  return { supabase, admin };
}

export async function approveCustomAttackTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await adminGuard();
  if (!ctx) return { ok: false, error: "Sovereign admin only." };

  const { error } = await ctx.supabase
    .from("custom_attack_tools")
    .update({
      status: "approved",
      audit_result: `approved by sovereign admin @ ${new Date().toISOString()}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", toolId);

  if (error) {
    console.error("[admin/developer-tools] approve error:", error);
    return { ok: false, error: "Database error." };
  }
  revalidatePath("/admin/developer-tools");
  revalidatePath("/admin/evolution");
  return { ok: true };
}

export async function rejectCustomAttackTool(toolId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await adminGuard();
  if (!ctx) return { ok: false, error: "Sovereign admin only." };

  const note = (reason || "rejected by sovereign admin").slice(0, 240);
  const { error } = await ctx.supabase
    .from("custom_attack_tools")
    .update({
      status: "rejected",
      audit_result: `rejected: ${note}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", toolId);

  if (error) {
    console.error("[admin/developer-tools] reject error:", error);
    return { ok: false, error: "Database error." };
  }
  revalidatePath("/admin/developer-tools");
  revalidatePath("/admin/evolution");
  return { ok: true };
}

export async function disableCustomAttackTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await adminGuard();
  if (!ctx) return { ok: false, error: "Sovereign admin only." };

  const { error } = await ctx.supabase
    .from("custom_attack_tools")
    .update({
      status: "disabled",
      audit_result: `disabled by sovereign admin @ ${new Date().toISOString()}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", toolId);

  if (error) {
    console.error("[admin/developer-tools] disable error:", error);
    return { ok: false, error: "Database error." };
  }
  revalidatePath("/admin/developer-tools");
  revalidatePath("/admin/evolution");
  return { ok: true };
}
