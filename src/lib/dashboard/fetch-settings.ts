import { createServerSupabase } from "@/lib/supabase/server";
import type { ApiKeyRow } from "@/app/dashboard/settings/api-keys-section";
import type { Database } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SettingsPageData {
  profile: ProfileRow | null;
  apiKeys: ApiKeyRow[];
  lastSignIn: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  domainVerified: boolean;
  hasSignature: boolean;
  identityProofed: boolean;
  identityVerified: boolean;
  clearanceTier: "tactical" | "professional" | "sovereign";
  auditScore: number | null;
  sovereignPending: boolean;
  docPath: string | null;
}

const EMPTY: SettingsPageData = {
  profile: null,
  apiKeys: [],
  lastSignIn: null,
  emailVerified: false,
  phoneVerified: false,
  domainVerified: false,
  hasSignature: false,
  identityProofed: false,
  identityVerified: false,
  clearanceTier: "tactical",
  auditScore: null,
  sovereignPending: false,
  docPath: null,
};

export async function fetchSettingsPageData(
  user: User,
  profile: ProfileRow | null,
): Promise<SettingsPageData> {
  try {
    const lastSignIn =
      user.last_sign_in_at ??
      (user as { email_confirmed_at?: string | null }).email_confirmed_at ??
      null;

    let apiKeys: ApiKeyRow[] = [];
    try {
      const supabase = await createServerSupabase();
      const { data: rawKeys, error } = await supabase
        .from("user_api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[settings] user_api_keys:", error.message);
      } else {
        apiKeys = (rawKeys ?? []) as ApiKeyRow[];
      }
    } catch (keysErr) {
      console.error("[settings] user_api_keys fetch:", keysErr);
    }

    const emailVerified = !!user.email_confirmed_at;
    const clearanceRaw = profile?.clearance_tier ?? "tactical";
    const clearanceTier =
      clearanceRaw === "professional" || clearanceRaw === "sovereign"
        ? clearanceRaw
        : "tactical";

    return {
      profile,
      apiKeys,
      lastSignIn,
      emailVerified,
      phoneVerified: profile?.phone_verified ?? false,
      domainVerified: profile?.domain_verified ?? false,
      hasSignature: !!profile?.signature_data,
      identityProofed: profile?.identity_proofed ?? false,
      identityVerified: profile?.identity_verified ?? false,
      clearanceTier,
      auditScore: profile?.identity_audit_score
        ? Number(profile.identity_audit_score)
        : null,
      sovereignPending: profile?.sovereign_pending ?? false,
      docPath: profile?.identity_document_path ?? null,
    };
  } catch (err) {
    console.error("[settings] fetchSettingsPageData:", err);
    return { ...EMPTY, profile };
  }
}
