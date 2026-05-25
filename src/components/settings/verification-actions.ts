"use server";

import { createHash, randomInt } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { buildCustodyHash } from "@/lib/verify/custody-hash";
import { sendOtpSms } from "@/lib/sms/send-otp-sms";

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function logOtpError(context: string, err: { message?: string; code?: string; details?: string; hint?: string }) {
  console.error(
    `[verify:otp] ${context}:`,
    err.message ?? "unknown",
    "| code:", err.code ?? "—",
    "| details:", err.details ?? "—",
    "| hint:", err.hint ?? "—",
  );
}

async function writeOtpLog(
  admin: ReturnType<typeof createAdminSupabase>,
  payload: {
    user_id: string;
    phone: string;
    status: "queued" | "sent" | "failed" | "verified" | "expired";
    provider?: string;
    error_message?: string;
  },
) {
  const { error } = await admin.from("otp_logs").insert(payload);
  if (error) {
    logOtpError("otp_logs insert", error);
  }
}

export async function sendOTP(phone: string): Promise<{ error?: string; devCode?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10) return { error: "Enter a valid phone number." };

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:otp] createAdminSupabase failed:", msg);
    return { error: "Server misconfigured. SUPABASE_SERVICE_ROLE_KEY required for OTP." };
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) {
    console.error(
      "[verify:otp] TWILIO_ACCOUNT_SID is missing — SMS cannot be sent. " +
        "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER on Vercel.",
    );
  } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error(
      "[verify:otp] SUPABASE_SERVICE_ROLE_KEY is missing — OTP insert will fail RLS.",
    );
  }

  await writeOtpLog(admin, {
    user_id: user.id,
    phone: normalized,
    status: "queued",
    provider: process.env.TWILIO_ACCOUNT_SID ? "twilio" : "dev",
  });

  const { error: insertErr } = await admin.from("verification_otps").insert({
    user_id: user.id,
    phone: normalized,
    code_hash: hashOtp(code),
    expires_at: expiresAt,
  });

  if (insertErr) {
    logOtpError("verification_otps insert", insertErr);
    await writeOtpLog(admin, {
      user_id: user.id,
      phone: normalized,
      status: "failed",
      error_message: insertErr.message,
    });
    return {
      error: `Could not queue OTP: ${insertErr.message}`,
    };
  }

  console.log(
    "[verify:otp] OTP queued via service_role into verification_otps for user",
    user.id.slice(0, 8),
  );

  const sms = await sendOtpSms(normalized, code);
  if (!sms.ok) {
    await writeOtpLog(admin, {
      user_id: user.id,
      phone: normalized,
      status: "failed",
      provider: "twilio",
      error_message: sms.error ?? "SMS delivery failed",
    });
    return { error: sms.error ?? "SMS delivery failed." };
  }

  await writeOtpLog(admin, {
    user_id: user.id,
    phone: normalized,
    status: "sent",
    provider: process.env.TWILIO_ACCOUNT_SID ? "twilio" : "dev",
  });

  if (process.env.NODE_ENV === "development") {
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
  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:otp] createAdminSupabase failed:", msg);
    return { error: "Server misconfigured." };
  }

  const { data: row, error: fetchErr } = await admin
    .from("verification_otps")
    .select("id, code_hash, expires_at, consumed")
    .eq("user_id", user.id)
    .eq("phone", normalized)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    logOtpError("verification_otps fetch", fetchErr);
    return { error: fetchErr.message };
  }

  if (!row) return { error: "No OTP pending. Request a new code." };
  if (row.consumed) return { error: "Code already used." };
  if (new Date(row.expires_at) < new Date()) {
    await writeOtpLog(admin, {
      user_id: user.id,
      phone: normalized,
      status: "expired",
    });
    return { error: "Code expired." };
  }
  if (row.code_hash !== hashOtp(code.trim())) return { error: "Invalid code." };

  await admin
    .from("verification_otps")
    .update({ consumed: true })
    .eq("id", row.id);

  const supabase = await createServerSupabase();
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ phone_verified: true, phone: normalized })
    .eq("id", user.id);

  if (profileErr) {
    logOtpError("profiles phone update", profileErr);
    return { error: profileErr.message };
  }

  await writeOtpLog(admin, {
    user_id: user.id,
    phone: normalized,
    status: "verified",
  });

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
    .update({
      signature_data: dataUrl,
      signature_at: signedAt,
      identity_verified: true,
    })
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
  revalidatePath("/dashboard");
  return { custodyHash };
}

function isValidCaptureDataUrl(dataUrl: string): boolean {
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) return false;
  const base64 = dataUrl.split(",")[1];
  if (!base64 || base64.length < 100) return false;
  try {
    return Buffer.from(base64, "base64").byteLength > 512;
  } catch {
    return false;
  }
}

export async function saveWebcamCapture(
  dataUrl: string,
): Promise<{ error?: string; verified?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };
  if (!isValidCaptureDataUrl(dataUrl)) {
    return { error: "Invalid capture. Retake photo with camera active." };
  }

  const path = `${user.id}/webcam-${Date.now()}.jpg`;
  const base64 = dataUrl.split(",")[1]!;
  const buffer = Buffer.from(base64, "base64");
  const admin = createAdminSupabase();

  const { error: uploadErr } = await admin.storage
    .from("verification-docs")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (uploadErr) {
    console.error("[verify:webcam] storage:", uploadErr.message, uploadErr);
  }

  const supabase = await createServerSupabase();
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      identity_proofed: true,
      identity_document_path: path,
      identity_verified: true,
    })
    .eq("id", user.id);

  if (profileErr) {
    console.error("[verify:webcam] profile update:", profileErr.message, profileErr);
    return { error: profileErr.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { verified: true };
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
