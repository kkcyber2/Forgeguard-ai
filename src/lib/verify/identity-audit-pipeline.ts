/**
 * Shared identity audit orchestration — storage download, profile update.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  deriveFailureReason,
  runIdentityAuditFromStorage,
  type IdentityAuditResult,
} from "@/lib/verify/ai-audit";

export const PASS_THRESHOLD = 80;

export function resolveAuditOutcome(result: IdentityAuditResult) {
  const passed = result.name_match && result.confidence_score >= PASS_THRESHOLD;
  const status = passed
    ? ("passed" as const)
    : result.confidence_score >= 60
      ? ("review" as const)
      : ("failed" as const);
  return { passed, status };
}

export interface IdentityAuditExecution {
  result: IdentityAuditResult;
  passed: boolean;
  status: "passed" | "review" | "failed";
  failure_reason?: string;
}

export async function executeIdentityAuditForUser(
  userId: string,
  documentPath: string,
  profile: { full_name: string | null; email: string | null; identity_document_path?: string | null },
  documentTextOverride?: string,
): Promise<{ error?: string } & Partial<IdentityAuditExecution>> {
  if (!profile.full_name?.trim()) {
    return { error: "Set your full name in Profile before auditing." };
  }

  if (!documentPath.startsWith(`${userId}/`)) {
    return { error: "Invalid document path for this account." };
  }

  const fullName = profile.full_name.trim();
  const auditResult = await runIdentityAuditFromStorage({
    documentPath,
    profileFullName: fullName,
    profileEmail: profile.email ?? "",
    documentTextOverride,
  });

  if (auditResult.error) {
    return { error: auditResult.error, failure_reason: auditResult.failure_reason };
  }

  const result = auditResult.result!;
  const { passed, status } = resolveAuditOutcome(result);
  const failure_reason = deriveFailureReason(result, passed);

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:ai-audit] createAdminSupabase:", msg);
    return { error: "Server misconfigured for identity audit persistence." };
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      identity_audit_score: result.confidence_score,
      identity_audit_status: status,
      identity_audit_notes: result.audit_notes,
      sovereign_pending: status === "review" || status === "passed",
      identity_document_path: documentPath,
      ...(passed
        ? {
            identity_verified: true,
            clearance_tier: "sovereign",
            sovereign_pending: false,
            access_level: 5,
          }
        : {}),
    })
    .eq("id", userId);

  if (updateErr) {
    const msg = updateErr.message ?? "Profile update failed";
    console.error("[verify:ai-audit] profile update:", msg, updateErr.code);
    const lower = msg.toLowerCase();
    if (
      updateErr.code === "42703" ||
      updateErr.code === "PGRST204" ||
      lower.includes("identity_audit_status")
    ) {
      return {
        error:
          "Identity audit columns missing — apply sovereign verification migration in Supabase.",
        failure_reason: msg,
      };
    }
    return { error: msg, failure_reason: msg };
  }

  return { result, passed, status, failure_reason: passed ? undefined : failure_reason };
}
