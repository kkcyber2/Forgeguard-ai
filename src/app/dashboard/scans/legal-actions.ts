"use server";

import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { LEGAL_POLICY_VERSION } from "@/lib/legal/consent";

export type LegalIntensity = "high" | "nuclear";

/** Cryptographic consent fields (v2) supplied by the modal after Web Crypto signing. */
export interface LegalConsentFields {
  target_host: string;
  policy_version: string;
  signature_hash: string;
  signed_at: string;
}

export interface LegalAuthResult {
  ok: boolean;
  authId?: string;
  error?: string;
}

export async function submitLegalAuthorization(
  fullName: string,
  intensity: LegalIntensity,
  consent: LegalConsentFields,
): Promise<LegalAuthResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized — session expired." };
  }

  const name = fullName.trim();
  if (name.length < 2) {
    return { ok: false, error: "Legal name is required." };
  }

  if (!consent?.signature_hash || consent.signature_hash.length !== 64) {
    return { ok: false, error: "Consent signature is missing or malformed." };
  }

  if (consent.policy_version !== LEGAL_POLICY_VERSION) {
    return { ok: false, error: "Unsupported consent policy version." };
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const userAgent = headersList.get("user-agent") ?? "unknown";

  const admin = createAdminSupabase();
  // Cast through `any` — generated types are stale vs the v2 consent columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insertError } = await (admin as any)
    .from("legal_authorizations")
    .insert({
      user_id: user.id,
      scan_id: null,
      full_name: name,
      ip_address: ip,
      user_agent: userAgent,
      intensity,
      consented: true,
      policy_version: consent.policy_version,
      target_host: consent.target_host,
      signature_hash: consent.signature_hash,
      signed_at: consent.signed_at,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[legal-auth] insert failed:", insertError.message);
    return { ok: false, error: "Authorization record failed. Try again." };
  }

  return { ok: true, authId: data.id };
}
