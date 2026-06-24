"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import {
  executeIdentityAuditForUser,
  persistIdentityFailureReason,
  persistSovereignBypass,
} from "@/lib/verify/identity-audit-pipeline";
import type { IdentityAuditResult } from "@/lib/verify/ai-audit";
import {
  companyTagFromDomain,
  emailMatchesCompanyDomain,
  validateReservedTagForDomain,
} from "@/lib/trust/identity";

export interface RunAiAuditResponse {
  ok?: boolean;
  success?: boolean;
  error?: string;
  reason?: string;
  failure_reason?: string;
  identity_failure_reason?: string | null;
  profile_full_name?: string;
  result?: IdentityAuditResult;
  passed?: boolean;
  status?: string;
}

const ENGINE_COMM_FAIL_REASON =
  "Engine communication failed — check Railway/Vercel token sync.";

function isEngineCommunicationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /engine ocr|python_engine_url|internal_scan_token|fetch failed|503|401|502|504|engine unreachable|engine communication|timed out|timeout|abort/i.test(
      message,
    ) || lower.includes("engine")
  );
}

function engineCommFailResponse(reason: string): RunAiAuditResponse {
  return {
    success: false,
    ok: false,
    error: "ENGINE_COMM_FAIL",
    reason,
    failure_reason: reason,
    identity_failure_reason:
      "Engine unreachable — verify INTERNAL_SCAN_TOKEN matches Railway.",
    status: "failed",
  };
}

export async function runAiAudit(
  documentPath: string,
): Promise<RunAiAuditResponse> {
  let userId: string | undefined;

  try {
    const user = await getSessionUser();
    if (!user) return { error: "Not authenticated." };
    userId = user.id;

    if (isSovereignOperator(user.email)) {
      const path = documentPath?.trim() || `${user.id}/sovereign`;
      const bypass = await persistSovereignBypass(user.id, path);
      if (bypass.error) {
        return {
          error: bypass.error,
          failure_reason: bypass.error,
          identity_failure_reason: bypass.error,
        };
      }
      return {
        ok: true,
        success: true,
        passed: true,
        status: "passed",
        result: bypass.result,
        identity_failure_reason: null,
      };
    }

    if (!documentPath?.trim()) {
      const reason = "No identity document on file. Upload or capture first.";
      await persistIdentityFailureReason(user.id, reason);
      return { error: reason, failure_reason: reason, identity_failure_reason: reason };
    }

    let admin: ReturnType<typeof createAdminSupabase>;
    try {
      admin = createAdminSupabase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Admin client unavailable";
      console.error("[verify:auditor] createAdminSupabase failed:", msg);
      return { error: "Server misconfigured for identity audit." };
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("full_name, email, identity_document_path, is_ghost_active")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      console.error("[verify:auditor] profile read:", profileErr.message);
      return { error: "Could not load profile for audit." };
    }

    if (!profile?.full_name) {
      const reason = "Profile name required for ID cross-check.";
      await persistIdentityFailureReason(user.id, reason);
      return { error: "Set your full name in Profile before auditing.", failure_reason: reason, identity_failure_reason: reason };
    }

    let outcome: Awaited<ReturnType<typeof executeIdentityAuditForUser>>;
    try {
      outcome = await executeIdentityAuditForUser(
        user.id,
        documentPath.trim(),
        profile,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[verify:auditor] ENGINE_COMM_FAIL:", reason);
      await persistIdentityFailureReason(user.id, ENGINE_COMM_FAIL_REASON);
      return engineCommFailResponse(reason);
    }

    console.error(
      "[verify:auditor] runAiAudit outcome (pre-persist):",
      JSON.stringify({
        error: outcome.error,
        failure_reason: outcome.failure_reason,
        identity_failure_reason: outcome.identity_failure_reason,
        status: outcome.status,
        passed: outcome.passed,
        result: outcome.result,
      }),
    );

    if (outcome.error) {
      const reason = outcome.identity_failure_reason ?? outcome.failure_reason ?? outcome.error;
      if (isEngineCommunicationError(outcome.error) || isEngineCommunicationError(reason)) {
        console.error("[verify:auditor] ENGINE_COMM_FAIL (soft):", {
          userId: user.id,
          documentPath: documentPath.trim(),
          error: outcome.error,
          failure_reason: reason,
        });
        return engineCommFailResponse(reason);
      }
      console.error("[verify:auditor] runAiAudit failed:", {
        userId: user.id,
        documentPath: documentPath.trim(),
        error: outcome.error,
        failure_reason: reason,
      });
      return {
        error: outcome.error,
        failure_reason: reason,
        identity_failure_reason: reason,
        status: "failed",
      };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const reason = outcome.identity_failure_reason ?? outcome.failure_reason ?? null;

    return {
      ok: true,
      success: true,
      result: outcome.result,
      passed: outcome.passed,
      status: outcome.status,
      failure_reason: reason ?? undefined,
      identity_failure_reason: reason,
      profile_full_name: profile.full_name ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Identity audit failed";
    console.error("[verify:auditor] runAiAudit:", msg);
    if (userId) {
      await persistIdentityFailureReason(userId, msg);
    }
    if (isEngineCommunicationError(msg)) {
      return engineCommFailResponse(msg);
    }
    return { error: msg, failure_reason: msg, identity_failure_reason: msg, success: false, ok: false };
  }
}

export async function saveSignature(
  dataUrl: string,
): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      signature_data: dataUrl,
      signature_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return {};
}

export async function initiateDomainVerification(
  domain: string,
): Promise<{ token?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!cleaned || !cleaned.includes(".")) {
    return { error: "Enter a valid corporate domain (e.g. acme.com)." };
  }

  const token = randomBytes(16).toString("hex");

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:domain] createAdminSupabase failed:", msg);
    return { error: "Server misconfigured for corporate verification." };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      company_domain: cleaned,
      domain_token: token,
      domain_verified: false,
    })
    .eq("id", user.id);

  if (error) {
    console.error(
      "[verify:domain] profiles upsert failed:",
      error.message,
      "| code:", error.code ?? "—",
      "| details:", error.details ?? "—",
      "| hint:", error.hint ?? "—",
    );
    return { error: `Corporate verification failed: ${error.message}` };
  }

  revalidatePath("/dashboard/settings");
  return { token };
}

export async function checkDomainVerification(
  domain: string,
  token: string,
): Promise<{ verified?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const cleaned = domain.trim().toLowerCase();

  try {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleaned)}&type=TXT`,
      { headers: { Accept: "application/dns-json" } },
    );
    const json = (await resp.json()) as {
      Answer?: Array<{ data: string }>;
    };

    const expectedValue = `forgeguard-verify=${token}`;
    const found = json.Answer?.some((r) =>
      r.data.replace(/"/g, "").includes(expectedValue),
    ) ?? false;

    if (!found) {
      return {
        error: `TXT record not found yet. Ensure "${expectedValue}" is published, then retry.`,
      };
    }

    const admin = createAdminSupabase();
    const tag = companyTagFromDomain(cleaned);
    const reservedErr = validateReservedTagForDomain(tag, cleaned);
    if (reservedErr) {
      return { error: reservedErr };
    }
    const { error: dbErr } = await admin
      .from("profiles")
      .update({
        domain_verified: true,
        company_domain: cleaned,
        company_tag: tag,
      })
      .eq("id", user.id);

    if (dbErr) {
      console.error("[verify:domain] verify update:", dbErr.message, dbErr);
      return { error: dbErr.message };
    }

    revalidatePath("/dashboard/settings");
    return { verified: true };
  } catch (e) {
    console.error("[verify:domain] DNS lookup:", e);
    return { error: "DNS lookup failed. Try again in a moment." };
  }
}

export async function verifyWorkEmail(): Promise<{
  verified?: boolean;
  error?: string;
}> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    return { error: msg };
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("domain_verified, company_domain, work_email_verified, email")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return { error: "Could not load profile." };
  }

  if (!profile.domain_verified) {
    return { error: "Verify your corporate domain first." };
  }

  if (!profile.company_domain) {
    return { error: "No company domain on file." };
  }

  const authEmail = user.email ?? profile.email;
  if (!authEmail || !emailMatchesCompanyDomain(authEmail, profile.company_domain)) {
    return {
      error: `Sign in with a @${profile.company_domain} email to verify work email.`,
    };
  }

  if (profile.work_email_verified) {
    return { verified: true };
  }

  const { error } = await admin
    .from("profiles")
    .update({ work_email_verified: true })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { verified: true };
}
