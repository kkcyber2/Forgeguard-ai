"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

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
