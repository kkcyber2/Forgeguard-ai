"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import {
  extractTargetHost,
  generateOwnershipToken,
  probeOwnershipFile,
} from "@/lib/scan/ownership";

export async function issueScanOwnershipToken(
  targetUrl: string,
): Promise<{ error?: string; token?: string; host?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const host = extractTargetHost(targetUrl);
  if (!host) return { error: "Enter a valid target URL first." };

  const token = generateOwnershipToken();
  const admin = createAdminSupabase();

  await admin.from("target_verifications").upsert(
    {
      user_id: user.id,
      target_domain: host,
      method: "file_upload",
      token,
      verified: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id,target_domain" },
  );

  return { token, host };
}

export async function verifyScanOwnership(
  targetUrl: string,
  token: string,
): Promise<{ verified: boolean; detail: string }> {
  const user = await getSessionUser();
  if (!user) return { verified: false, detail: "Not authenticated." };

  const result = await probeOwnershipFile(targetUrl, token);
  if (!result.verified) return result;

  const host = extractTargetHost(targetUrl);
  if (host) {
    const admin = createAdminSupabase();
    await admin
      .from("target_verifications")
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("target_domain", host);
  }

  return result;
}
