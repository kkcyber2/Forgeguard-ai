"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  canAccessDevMode,
  redirectForPersona,
  type SovereignRole,
} from "@/lib/access/parallel-sovereignty";

export async function switchPersona(
  role: SovereignRole,
): Promise<{ error?: string; redirectTo?: "/admin" | "/dashboard" }> {
  if (role !== "client" && role !== "hacker" && role !== "dev") {
    return { error: "Invalid persona." };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, role, clearance_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.user_type) {
    return { error: "Complete identity selection first." };
  }

  if (role === "dev") {
    if (!canAccessDevMode(profile.clearance_tier, profile.role)) {
      return { error: "Sovereign clearance and admin role required for Dev mode." };
    }
  } else {
    if (role === "hacker" && profile.user_type === "client") {
      return { error: "Client accounts cannot switch to Hacker mode." };
    }
    if (role === "client" && profile.user_type === "hacker") {
      return { error: "Hacker accounts cannot switch to Client mode." };
    }
  }

  const updatePayload: {
    current_persona: SovereignRole;
    active_view_mode?: "client" | "hacker";
  } = { current_persona: role };

  if (role === "client" || role === "hacker") {
    updatePayload.active_view_mode = role;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");

  return { redirectTo: redirectForPersona(role) };
}

/** @deprecated Use switchPersona */
export async function switchViewMode(
  mode: "client" | "hacker",
): Promise<{ error?: string }> {
  const result = await switchPersona(mode);
  if (result.error) return { error: result.error };
  return {};
}
