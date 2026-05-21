"use server";

import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

/* ── saveSignature ──────────────────────────────────────────── */
export async function saveSignature(
  dataUrl: string,
): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  // Store as base64 string in profiles table — cast to any for new columns not yet in generated types
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db
    .from("profiles")
    .update({ signature_data: dataUrl, signature_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return {};
}

/* ── initiateDomainVerification ─────────────────────────────── */
export async function initiateDomainVerification(
  domain: string,
): Promise<{ token?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  // Generate a unique verification token
  const token = randomBytes(16).toString("hex");

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db
    .from("profiles")
    .update({
      company_domain: domain,
      domain_verify_token: token,
      domain_verified: false,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { token };
}

/* ── checkDomainVerification ────────────────────────────────── */
/**
 * Performs a DNS TXT lookup via a public DNS-over-HTTPS resolver.
 * Checks for: forgeguard-verify=<token> in the domain's TXT records.
 * If found, marks the profile domain_verified = true.
 */
export async function checkDomainVerification(
  domain: string,
  token: string,
): Promise<{ verified?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  try {
    // Use Cloudflare DoH for DNS TXT lookup
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
      return { error: `TXT record not found yet. Ensure "${expectedValue}" is published, then retry.` };
    }

    // Mark verified in DB
    const supabase = await createServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { error: dbErr } = await db
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
