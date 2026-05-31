"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Soft-delete request: sets deletion_requested_at and signs the user out.
 */
export async function requestAccountDeletion(): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[account-deletion] update failed:", error.message);
    return { error: "Could not record deletion request" };
  }

  await supabase.auth.signOut();
  redirect("/auth/login?deleted=1");
}
