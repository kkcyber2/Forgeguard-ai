"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

export async function switchViewMode(
  mode: ViewMode,
): Promise<{ error?: string }> {
  if (mode !== "client" && mode !== "hacker") {
    return { error: "Invalid view mode." };
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
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile?.user_type) {
    return { error: "Complete identity selection first." };
  }

  if (mode === "hacker" && profile.user_type === "client") {
    return { error: "Client accounts cannot switch to Hacker mode." };
  }
  if (mode === "client" && profile.user_type === "hacker") {
    return { error: "Hacker accounts cannot switch to Client mode." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_view_mode: mode })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return {};
}
