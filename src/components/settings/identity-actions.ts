"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { executeIdentityAuditForUser } from "@/lib/verify/identity-audit-pipeline";
import type { IdentityAuditResult } from "@/lib/verify/ai-audit";

export interface RunAiAuditResponse {
  ok?: boolean;
  error?: string;
  failure_reason?: string;
  profile_full_name?: string;
  result?: IdentityAuditResult;
  passed?: boolean;
  status?: string;
}

export async function runAiAudit(
  documentPath: string,
): Promise<RunAiAuditResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Not authenticated." };

    if (!documentPath?.trim()) {
      return { error: "No identity document on file. Upload or capture first." };
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
      .select("full_name, email, identity_document_path")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      console.error("[verify:auditor] profile read:", profileErr.message);
      return { error: "Could not load profile for audit." };
    }

    if (!profile?.full_name) {
      return {
        error: "Set your full name in Profile before auditing.",
        failure_reason: "Profile name required for ID cross-check.",
      };
    }

    const outcome = await executeIdentityAuditForUser(
      user.id,
      documentPath.trim(),
      profile,
    );

    if (outcome.error) {
      console.error("[verify:auditor] runAiAudit failed:", {
        userId: user.id,
        documentPath: documentPath.trim(),
        error: outcome.error,
        failure_reason: outcome.failure_reason ?? outcome.error,
      });
      return {
        error: outcome.error,
        failure_reason: outcome.failure_reason ?? outcome.error,
      };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    return {
      ok: true,
      result: outcome.result,
      passed: outcome.passed,
      status: outcome.status,
      failure_reason: outcome.failure_reason,
      profile_full_name: profile.full_name ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Identity audit failed";
    console.error("[verify:auditor] runAiAudit:", msg);
    return { error: msg, failure_reason: msg };
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
    const tag = cleaned.split(".")[0]?.toUpperCase() ?? "CORP";
    const { error: dbErr } = await admin
      .from("profiles")
      .update({
        domain_verified: true,
        company_domain: cleaned,
        company_tag: `${tag} SEC`,
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
