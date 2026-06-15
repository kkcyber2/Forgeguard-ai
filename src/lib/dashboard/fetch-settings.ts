import { createServerSupabase } from "@/lib/supabase/server";
import { safeQueryRows } from "@/lib/supabase/safe-query";
import { fetchUserApiKeys } from "@/lib/supabase/queries";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { resolveTrustLevelFromHackerRank } from "@/lib/access/trust-score";
import type { ApiKeyRow } from "@/app/dashboard/settings/api-keys-section";
import type { Database } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SettingsPageData {
  profile: ProfileRow | null;
  apiKeys: ApiKeyRow[];
  lastSignIn: string | null;
  emailVerified: boolean;
  faceLivenessVerified: boolean;
  faceLivenessPoseCount: number;
  domainVerified: boolean;
  hasSignature: boolean;
  identityProofed: boolean;
  /** @deprecated alias — use faceLivenessVerified */
  identityVerified: boolean;
  clearanceTier: "pending" | "tactical" | "professional" | "sovereign";
  auditScore: number | null;
  sovereignPending: boolean;
  docPath: string | null;
  /** Trust tier from hacker_rank — 0 when rank missing. */
  hackerRankTrust: number;
}

const EMPTY: SettingsPageData = {
  profile: null,
  apiKeys: [],
  lastSignIn: null,
  emailVerified: false,
  faceLivenessVerified: false,
  faceLivenessPoseCount: 0,
  domainVerified: false,
  hasSignature: false,
  identityProofed: false,
  identityVerified: false,
  clearanceTier: "tactical",
  auditScore: null,
  sovereignPending: false,
  docPath: null,
  hackerRankTrust: 0,
};

function normalizeProfile(row: ProfileRow | null): ProfileRow | null {
  if (!row) return null;
  return {
    ...row,
    hacker_rank: row.hacker_rank != null ? String(row.hacker_rank) : null,
    access_level: row.access_level ?? 1,
    role: row.role ?? "user",
  };
}

async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await safeQueryRows<ProfileRow>(
      "settings/profile",
      () => supabase.from("profiles").select("*").eq("id", userId).limit(1),
    );
    return normalizeProfile(data[0] ?? null);
  } catch (err) {
    console.error("[settings] profile fetch:", err);
    return null;
  }
}

export async function fetchSettingsPageData(
  user: User,
  profileInput: ProfileRow | null,
): Promise<SettingsPageData> {
  try {
    let profile = normalizeProfile(profileInput);
    if (!profile) {
      profile = await fetchProfileRow(user.id);
    }

    const lastSignIn =
      user.last_sign_in_at ??
      (user as { email_confirmed_at?: string | null }).email_confirmed_at ??
      null;

    let apiKeys: ApiKeyRow[] = [];
    try {
      const supabase = await createServerSupabase();
      apiKeys = await fetchUserApiKeys(supabase, user.id);
    } catch (keysErr) {
      console.error("[settings] user_api_keys fetch:", keysErr);
    }

    const sovereign = isSovereignOperator(user.email);
    const emailVerified = sovereign || !!user.email_confirmed_at;
    const clearanceRaw = profile?.clearance_tier ?? "tactical";
    const clearanceTier = sovereign
      ? "sovereign"
      : clearanceRaw === "professional" ||
          clearanceRaw === "sovereign" ||
          clearanceRaw === "pending"
        ? clearanceRaw
        : "tactical";

    const hackerRankTrust = profile?.hacker_rank
      ? resolveTrustLevelFromHackerRank(profile.hacker_rank)
      : 0;

    return {
      profile,
      apiKeys,
      lastSignIn,
      emailVerified,
      faceLivenessVerified:
        sovereign || (profile?.face_liveness_verified ?? false),
      faceLivenessPoseCount: profile?.face_liveness_pose_count ?? 0,
      domainVerified: sovereign || (profile?.domain_verified ?? false),
      hasSignature: sovereign || !!profile?.signature_data,
      identityProofed:
        sovereign ||
        (profile?.face_liveness_verified ?? profile?.identity_proofed ?? false),
      identityVerified: sovereign || (profile?.identity_verified ?? false),
      clearanceTier,
      auditScore: sovereign
        ? 100
        : profile?.identity_audit_score
          ? Number(profile.identity_audit_score)
          : null,
      sovereignPending: sovereign ? false : (profile?.sovereign_pending ?? false),
      docPath: profile?.identity_document_path ?? null,
      hackerRankTrust,
    };
  } catch (err) {
    console.error("[settings] fetchSettingsPageData:", err);
    return { ...EMPTY, profile: normalizeProfile(profileInput) };
  }
}
