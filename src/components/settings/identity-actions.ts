"use server";

import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

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

  const token = randomBytes(16).toString("hex");

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      company_domain: domain,
      domain_token: token,
      domain_verified: false,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { token };
}

export async function checkDomainVerification(
  domain: string,
  token: string,
): Promise<{ verified?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  try {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
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

    const supabase = await createServerSupabase();
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({
        domain_verified: true,
        company_tag: domain.split(".")[0].toUpperCase() + " SEC",
      })
      .eq("id", user.id);

    if (dbErr) return { error: dbErr.message };
    revalidatePath("/dashboard/settings");
    return { verified: true };
  } catch (e) {
    console.error("[domain-verify]", e);
    return { error: "DNS lookup failed. Try again in a moment." };
  }
}
