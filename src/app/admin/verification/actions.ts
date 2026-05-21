"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { sendClearanceGrantedEmail } from "@/lib/email/send-clearance-granted";

export async function grantSovereignAccess(
  userId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdminProfile();
  if (!admin) return { error: "Unauthorized." };

  const db = createAdminSupabase();

  const { data: target } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({
      identity_verified: true,
      clearance_tier: "sovereign",
      access_level: 5,
      sovereign_pending: false,
      identity_audit_status: "passed",
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  if (target?.email) {
    await sendClearanceGrantedEmail(target.email, target.full_name);
  }

  revalidatePath("/admin/verification");
  revalidatePath("/admin/users");
  return {};
}
