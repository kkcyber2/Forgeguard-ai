/**
 * Shared identity audit orchestration — storage download, profile update.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import {
  deriveFailureReason,
  fuzzyNameSimilarity,
  REVIEW_REQUIRED_AUDIT_RESULT,
  runIdentityAuditFromStorage,
  type IdentityAuditResult,
} from "@/lib/verify/ai-audit";
import {
  buildIdentityRawOcrData,
  type IdentityRawOcrData,
} from "@/lib/verify/identity-raw-ocr";

export const PASS_THRESHOLD = 80;

const UNSURE_NOTE_RE =
  /unsure|unclear|ambiguous|manual review|cannot determine|inconclusive/i;

function isHardReject(result: IdentityAuditResult): boolean {
  const notes = (result.audit_notes ?? "").toLowerCase();
  return (
    notes.includes("blur") ||
    notes.includes("unreadable") ||
    notes.includes("illegible") ||
    notes.includes("too large")
  );
}

export function isIdentityUnsure(
  result: IdentityAuditResult,
  profileFullName: string,
): boolean {
  if (isHardReject(result)) return false;
  const score = result.confidence_score;
  if (score >= 45 && score < PASS_THRESHOLD) return true;
  if (UNSURE_NOTE_RE.test(result.audit_notes ?? "")) return true;
  const extracted = result.extracted_name?.trim() ?? "";
  if (extracted && profileFullName) {
    const sim = fuzzyNameSimilarity(profileFullName, extracted);
    if (sim >= 0.55 && sim < 0.8) return true;
  }
  return !result.name_match && score >= 45 && score < 60;
}

export function resolveAuditOutcome(
  result: IdentityAuditResult,
  profileFullName: string,
) {
  const passed =
    result.name_match && result.confidence_score >= PASS_THRESHOLD;

  if (passed) {
    return { passed: true as const, status: "passed" as const };
  }

  if (isIdentityUnsure(result, profileFullName)) {
    return { passed: false as const, status: "review" as const };
  }

  if (result.confidence_score >= 60 && !isHardReject(result)) {
    return { passed: false as const, status: "review" as const };
  }

  return { passed: false as const, status: "failed" as const };
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
  status: "passed" | "review" | "failed";
  explicit?: string;
  result?: IdentityAuditResult;
  error?: string;
}): string | null {
  if (opts.passed) return null;
  if (opts.status === "review") {
    return (
      opts.explicit?.trim() ||
      opts.result?.audit_notes?.trim() ||
      "Manual review required — identity could not be auto-verified."
    );
  }
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
    lower.includes("identity_failure_reason") ||
    lower.includes("identity_raw_ocr")
  );
}

const SOVEREIGN_AUDIT_RESULT: IdentityAuditResult = {
  extracted_name: "SOVEREIGN",
  name_match: true,
  confidence_score: 100,
  audit_notes: "VERIFIED: SOVEREIGN",
  mode: "heuristic",
};

async function persistSovereignBypass(
  userId: string,
  documentPath: string,
): Promise<Partial<IdentityAuditExecution> & { error?: string }> {
  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    return { error: msg };
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      identity_audit_score: 100,
      identity_audit_status: "passed",
      identity_audit_notes: "VERIFIED: SOVEREIGN",
      identity_failure_reason: null,
      identity_verified: true,
      clearance_tier: "sovereign",
      sovereign_pending: false,
      access_level: 5,
      identity_document_path: documentPath,
    })
    .eq("id", userId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  return {
    result: SOVEREIGN_AUDIT_RESULT,
    passed: true,
    status: "passed",
    identity_failure_reason: null,
  };
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
  profile: {
    full_name: string | null;
    email: string | null;
    identity_document_path?: string | null;
  },
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

  if (isSovereignOperator(profile.email)) {
    return persistSovereignBypass(userId, documentPath);
  }

  const fullName = profile.full_name.trim();
  const auditResult = await runIdentityAuditFromStorage({
    documentPath,
    profileFullName: fullName,
    profileEmail: profile.email ?? "",
    documentTextOverride,
  });

  if (auditResult.reviewRequired) {
    const reviewResult = REVIEW_REQUIRED_AUDIT_RESULT;
    const failure_reason = resolvePersistedFailureReason({
      passed: false,
      status: "review",
      result: reviewResult,
    });
    let adminReview: ReturnType<typeof createAdminSupabase>;
    try {
      adminReview = createAdminSupabase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Admin client unavailable";
      return { error: msg };
    }
    await adminReview
      .from("profiles")
      .update({
        identity_audit_score: reviewResult.confidence_score,
        identity_audit_status: "review",
        identity_audit_notes: reviewResult.audit_notes,
        identity_failure_reason: failure_reason,
        sovereign_pending: true,
        identity_document_path: documentPath,
      })
      .eq("id", userId);
    return {
      result: reviewResult,
      passed: false,
      status: "review",
      failure_reason: failure_reason ?? undefined,
      identity_failure_reason: failure_reason,
    };
  }

  if (auditResult.error) {
    const reason = auditResult.failure_reason ?? auditResult.error;
    if (auditResult.engine_raw !== undefined) {
      console.error(
        "[verify:ai-audit] engine RAW (pre-persist):",
        JSON.stringify(auditResult.engine_raw),
      );
    }
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
  const { passed, status } = resolveAuditOutcome(result, fullName);
  const failure_reason = resolvePersistedFailureReason({
    passed,
    status,
    explicit: auditResult.failure_reason,
    result,
  });

  if (auditResult.engine_raw !== undefined) {
    console.error(
      "[verify:ai-audit] engine RAW (pre-persist):",
      JSON.stringify(auditResult.engine_raw),
    );
  }

  let rawOcrPayload: IdentityRawOcrData | null = null;
  if (auditResult.raw_ocr) {
    rawOcrPayload = buildIdentityRawOcrData({
      imagePath: documentPath,
      rawOcrText: auditResult.raw_ocr.rawOcrText,
      mimeType: auditResult.raw_ocr.mimeType,
    });
  }

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
      ...(rawOcrPayload
        ? { identity_raw_ocr_data: rawOcrPayload as unknown as Json }
        : {}),
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
