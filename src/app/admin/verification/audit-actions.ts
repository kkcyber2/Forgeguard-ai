"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { extractIdentityDocumentText } from "@/lib/admin/document-text";
import { runIdentityAudit, type IdentityAuditResult } from "@/lib/verify/ai-audit";

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

  const documentText = await extractIdentityDocumentText(
    profile.identity_document_path,
    profile.full_name,
    profile.email ?? "",
  );

  const result = await runIdentityAudit({
    documentText,
    profileFullName: profile.full_name,
    profileEmail: profile.email ?? "",
  });

  const passed = result.name_match && result.confidence_score >= 80;
  const status = passed ? "passed" : result.confidence_score >= 60 ? "review" : "failed";

  await db
    .from("profiles")
    .update({
      identity_audit_score: result.confidence_score,
      identity_audit_status: status,
      identity_audit_notes: result.audit_notes,
      sovereign_pending: status === "review" || status === "passed",
      ...(passed ? { identity_verified: true } : {}),
    })
    .eq("id", userId);

  revalidatePath("/admin/verification");

  return {
    result: {
      ...result,
      profile_full_name: profile.full_name,
      document_path: profile.identity_document_path,
      mismatch: !result.name_match || result.confidence_score < 80,
    },
  };
}
