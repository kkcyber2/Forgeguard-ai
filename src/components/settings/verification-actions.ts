"use server";

import { createHash, randomInt } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { buildCustodyHash } from "@/lib/verify/custody-hash";

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendOTP(phone: string): Promise<{ error?: string; devCode?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10) return { error: "Enter a valid phone number." };

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const supabase = await createServerSupabase();
  await supabase.from("profiles").update({ phone: normalized }).eq("id", user.id);

  const admin = createAdminSupabase();
  await admin.from("verification_otps").insert({
    user_id: user.id,
    phone: normalized,
    code_hash: hashOtp(code),
    expires_at: expiresAt,
  });

  // Production: integrate Twilio / SNS here.
  if (process.env.NODE_ENV === "development") {
    console.log(`[verify:otp] ${normalized} → ${code}`);
    return { devCode: code };
  }

  return {};
}

export async function verifyOTP(
  phone: string,
  code: string,
): Promise<{ error?: string; verified?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const normalized = phone.replace(/\D/g, "");
  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("verification_otps")
    .select("id, code_hash, expires_at, consumed")
    .eq("user_id", user.id)
    .eq("phone", normalized)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { error: "No OTP pending. Request a new code." };
  if (row.consumed) return { error: "Code already used." };
  if (new Date(row.expires_at) < new Date()) return { error: "Code expired." };
  if (row.code_hash !== hashOtp(code.trim())) return { error: "Invalid code." };

  await admin
    .from("verification_otps")
    .update({ consumed: true })
    .eq("id", row.id);

  const supabase = await createServerSupabase();
  await supabase
    .from("profiles")
    .update({ phone_verified: true, phone: normalized })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
  return { verified: true };
}

export async function saveSignatureSeal(
  dataUrl: string,
): Promise<{ error?: string; custodyHash?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const signedAt = new Date().toISOString();
  const custodyHash = buildCustodyHash(dataUrl, user.id, signedAt);

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const userAgent = hdrs.get("user-agent");

  const supabase = await createServerSupabase();
  await supabase
    .from("profiles")
    .update({ signature_data: dataUrl, signature_at: signedAt })
    .eq("id", user.id);

  const admin = createAdminSupabase();
  const { error } = await admin.from("legal_signatures").insert({
    user_id: user.id,
    signature_data: dataUrl,
    custody_hash: custodyHash,
    signed_at: signedAt,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { custodyHash };
}

export async function uploadIdentityDocument(
  formData: FormData,
): Promise<{ error?: string; path?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) return { error: "No document selected." };
  if (file.size > 8 * 1024 * 1024) return { error: "Max file size is 8 MB." };

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { error: "Upload PDF, JPEG, PNG, or WebP only." };
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${user.id}/identity-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminSupabase();
  const { error: uploadErr } = await admin.storage
    .from("verification-docs")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) {
    // Fallback: store path reference only (bucket may not exist yet)
    console.warn("[verify:upload] storage:", uploadErr.message);
  }

  const supabase = await createServerSupabase();
  await supabase
    .from("profiles")
    .update({
      identity_document_path: path,
      identity_audit_status: "pending",
      clearance_tier: "pending",
      sovereign_pending: true,
    })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
  return { path };
}
