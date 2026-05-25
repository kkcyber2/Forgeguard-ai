"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { executeIdentityAuditForUser } from "@/lib/verify/identity-audit-pipeline";
import type { IdentityAuditResult } from "@/lib/verify/ai-audit";

export interface AdminAuditResponse {
  error?: string;
  result?: IdentityAuditResult & {
    profile_full_name: string;
    document_path: string | null;
    mismatch: boolean;
  };
}

export async function runAdminIdentityAudit(
  userId: string,
): Promise<AdminAuditResponse> {
  const admin = await requireAdminProfile();
  if (!admin) return { error: "Unauthorized." };

  const db = createAdminSupabase();
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, email, identity_document_path")
    .eq("id", userId)
    .single();

  if (!profile?.full_name) {
    return { error: "Operator has no full_name on file." };
  }

  if (!profile.identity_document_path) {
    return { error: "No identity document path on file." };
  }

  const outcome = await executeIdentityAuditForUser(
    userId,
    profile.identity_document_path,
    profile,
  );

  if (outcome.error || !outcome.result) {
    return { error: outcome.error ?? "Audit failed." };
  }

  const result = outcome.result;
  const passed = !!outcome.passed;

  revalidatePath("/admin/verification");

  return {
    result: {
      ...result,
      profile_full_name: profile.full_name,
      document_path: profile.identity_document_path,
      mismatch: !passed,
    },
  };
}
