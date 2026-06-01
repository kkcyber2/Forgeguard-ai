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
  identity_failure_reason?: string | null;
}

/** Human-readable rejection text for profiles.identity_failure_reason */
export function resolvePersistedFailureReason(opts: {
  passed: boolean;
  explicit?: string;
  result?: IdentityAuditResult;
  error?: string;
}): string | null {
  if (opts.passed) return null;
  if (opts.explicit?.trim()) return opts.explicit.trim();
  if (opts.result) {
    const derived = deriveFailureReason(opts.result, false);
    if (derived?.trim()) return derived.trim();
    if (opts.result.audit_notes?.trim()) return opts.result.audit_notes.trim();
  }
  if (opts.error?.trim()) return opts.error.trim();
  return "Identity audit did not pass.";
}

function isMissingIdentityColumn(err: {
  message?: string;
  code?: string;
}): boolean {
  const lower = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    lower.includes("identity_audit") ||
    lower.includes("identity_failure_reason")
  );
}

/** Persist rejection reason even when full audit update fails partially. */
export async function persistIdentityFailureReason(
  userId: string,
  reason: string,
  partial?: {
    status?: "failed" | "review" | "passed";
    score?: number;
    notes?: string;
  },
): Promise<void> {
  try {
    const admin = createAdminSupabase();
    const { error } = await admin
      .from("profiles")
      .update({
        identity_failure_reason: reason,
        identity_audit_status: partial?.status ?? "failed",
        ...(partial?.score != null ? { identity_audit_score: partial.score } : {}),
        ...(partial?.notes ? { identity_audit_notes: partial.notes } : {}),
      })
      .eq("id", userId);

    if (error) {
      console.warn(
        "[verify:ai-audit] persistIdentityFailureReason:",
        error.message,
        error.code,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[verify:ai-audit] persistIdentityFailureReason:", msg);
  }
}

export async function executeIdentityAuditForUser(
  userId: string,
  documentPath: string,
  profile: { full_name: string | null; email: string | null; identity_document_path?: string | null },
  documentTextOverride?: string,
): Promise<{ error?: string } & Partial<IdentityAuditExecution>> {
  if (!profile.full_name?.trim()) {
    const reason = "Set your full name in Profile before auditing.";
    await persistIdentityFailureReason(userId, reason);
    return { error: reason, failure_reason: reason, identity_failure_reason: reason };
  }

  if (!documentPath.startsWith(`${userId}/`)) {
    const reason = "Invalid document path for this account.";
    await persistIdentityFailureReason(userId, reason);
    return { error: reason, failure_reason: reason, identity_failure_reason: reason };
  }

  const fullName = profile.full_name.trim();
  const auditResult = await runIdentityAuditFromStorage({
    documentPath,
    profileFullName: fullName,
    profileEmail: profile.email ?? "",
    documentTextOverride,
  });

  if (auditResult.error) {
    const reason =
      auditResult.failure_reason ?? auditResult.error;
    await persistIdentityFailureReason(userId, reason, {
      status: "failed",
      notes: reason,
    });
    return {
      error: auditResult.error,
      failure_reason: reason,
      identity_failure_reason: reason,
    };
  }

  const result = auditResult.result!;
  const { passed, status } = resolveAuditOutcome(result);
  const failure_reason = resolvePersistedFailureReason({
    passed,
    explicit: auditResult.failure_reason,
    result,
  });

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
      identity_failure_reason: failure_reason,
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
    if (isMissingIdentityColumn(updateErr)) {
      const schemaMsg =
        "Identity audit columns missing — apply sovereign verification migration in Supabase.";
      return {
        error: schemaMsg,
        failure_reason: msg,
        identity_failure_reason: failure_reason ?? msg,
      };
    }
    if (failure_reason) {
      await persistIdentityFailureReason(userId, failure_reason, {
        status,
        score: result.confidence_score,
        notes: result.audit_notes,
      });
    }
    return {
      error: msg,
      failure_reason: failure_reason ?? msg,
      identity_failure_reason: failure_reason ?? msg,
    };
  }

  return {
    result,
    passed,
    status,
    failure_reason: failure_reason ?? undefined,
    identity_failure_reason: failure_reason,
  };
}
