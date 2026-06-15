"use server";

import { createHash, randomInt } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { buildCustodyHash } from "@/lib/verify/custody-hash";
import { resolveDocumentMime } from "@/lib/verify/resolve-document-mime";
import { sendOtpSms } from "@/lib/sms/send-otp-sms";
import type { Database } from "@/types/supabase";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const OTP_TTL_MS = 10 * 60 * 1000;
const SIMULATION_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readTwilioSimulationMode(): Promise<boolean> {
  if (
    process.env.TWILIO_SIMULATION_MODE === "true" ||
    process.env.TWILIO_SIMULATION_MODE === "1"
  ) {
    return true;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return false;

  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/platform_flags?key=eq.twilio_simulation_mode&select=value`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const msg = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 404 || msg.includes("platform_flags")) {
        return false;
      }
      console.warn("[verify:otp] platform_flags HTTP", res.status, msg);
      return false;
    }
    const rows = (await res.json()) as Array<{ value?: boolean }>;
    return rows[0]?.value === true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[verify:otp] platform_flags fetch:", msg);
    return false;
  }
}

const SCHEMA_SYNC_MSG = "System Syncing - Please Refresh (Ctrl+R)";

function isSchemaColumnError(msg: string): boolean {
  return /column.*not found|PGRST204|42703|schema cache/i.test(msg);
}

async function adminUpdateProfile(
  userId: string,
  full: ProfileUpdate,
  minimal: ProfileUpdate,
): Promise<{ error?: string; schemaSync?: boolean }> {
  try {
    const admin = createAdminSupabase();
    const { error: fullErr } = await admin
      .from("profiles")
      .update(full)
      .eq("id", userId);

    if (!fullErr) return {};

    console.warn("[verify:profile] full update:", fullErr.message);

    if (isSchemaColumnError(fullErr.message)) {
      const { error: minErr } = await admin
        .from("profiles")
        .update(minimal)
        .eq("id", userId);

      if (!minErr) return {};

      console.error("[verify:profile] minimal update:", minErr.message);
      if (isSchemaColumnError(minErr.message)) {
        return { schemaSync: true, error: SCHEMA_SYNC_MSG };
      }
      return { error: minErr.message };
    }

    return { error: fullErr.message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:profile] adminUpdateProfile:", msg);
    return { error: "Server misconfigured. SUPABASE_SERVICE_ROLE_KEY required." };
  }
}

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
  const simulation = await readTwilioSimulationMode();

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
    provider: simulation ? "simulation" : process.env.TWILIO_ACCOUNT_SID ? "twilio" : "dev",
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

  if (simulation) {
    await sleep(SIMULATION_DELAY_MS);
    await writeOtpLog(admin, {
      user_id: user.id,
      phone: normalized,
      status: "sent",
      provider: "simulation",
    });
    if (process.env.NODE_ENV === "development") {
      return { devCode: code };
    }
    return {};
  }

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

  const simulation = await readTwilioSimulationMode();
  if (simulation) {
    await sleep(SIMULATION_DELAY_MS);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return { error: "Enter a 6-digit code." };
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ phone_verified: true, phone: normalized })
      .eq("id", user.id);

    if (profileErr) {
      logOtpError("profiles phone update (simulation)", profileErr);
      return { error: profileErr.message };
    }

    await writeOtpLog(admin, {
      user_id: user.id,
      phone: normalized,
      status: "verified",
      provider: "simulation",
    });

    revalidatePath("/dashboard/settings");
    return { verified: true };
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
  _dataUrl: string,
): Promise<{ error?: string; verified?: boolean; schemaSync?: boolean }> {
  /** @deprecated Use FaceLiveness + submitFaceLiveness. Enterprise webcam proofing removed from clearance. */
  return {
    error:
      "Webcam identity proofing is deprecated. Complete Face Liveness in Clearance settings, or upload a government ID below.",
  };
}

export async function uploadIdentityDocument(
  formData: FormData,
): Promise<{ error?: string; path?: string; schemaSync?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) return { error: "No document selected." };
  if (file.size > 8 * 1024 * 1024) return { error: "Max file size is 8 MB." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const resolvedMime = resolveDocumentMime(file, buffer);
  if (!resolvedMime) {
    console.warn("[verify:upload] mime unresolved:", {
      name: file.name,
      reportedType: file.type || "(empty)",
      size: file.size,
    });
    return { error: "Could not detect file type. Use PDF, PNG, or JPEG." };
  }

  console.info("[verify:upload] document:", {
    name: file.name,
    resolvedMime,
    size: file.size,
  });

  const ext =
    resolvedMime === "application/pdf"
      ? "pdf"
      : resolvedMime === "image/png"
        ? "png"
        : resolvedMime === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${user.id}/identity-${Date.now()}.${ext}`;

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:upload] createAdminSupabase failed:", msg);
    return { error: "Server misconfigured. SUPABASE_SERVICE_ROLE_KEY required." };
  }

  const { error: uploadErr } = await admin.storage
    .from("verification-docs")
    .upload(path, buffer, { contentType: resolvedMime, upsert: true });

  if (uploadErr) {
    console.error("[verify:upload] storage:", uploadErr.message);
    return { error: uploadErr.message || "Storage upload failed." };
  }

  const profileResult = await adminUpdateProfile(
    user.id,
    {
      identity_document_path: path,
      identity_audit_status: "pending",
      clearance_tier: "pending",
      sovereign_pending: true,
    },
    {
      identity_document_path: path,
      identity_audit_status: "pending",
      sovereign_pending: true,
    },
  );

  if (profileResult.error) {
    console.error("[verify:upload] profile update:", profileResult.error);
    return {
      error: profileResult.error,
      schemaSync: profileResult.schemaSync,
    };
  }

  revalidatePath("/dashboard/settings");
  return { path };
}

export type FaceLivenessPose = "center" | "up" | "down" | "left" | "right";

const REQUIRED_POSES: FaceLivenessPose[] = [
  "center",
  "up",
  "down",
  "left",
  "right",
];

function distinctFrameHashes(poses: { pose: FaceLivenessPose; dataUrl: string }[]): boolean {
  const hashes = new Set<string>();
  for (const p of poses) {
    const base64 = p.dataUrl.split(",")[1] ?? "";
    let h = 0;
    for (let i = 0; i < Math.min(base64.length, 8000); i += 1) {
      h = (h * 31 + base64.charCodeAt(i)) | 0;
    }
    const key = String(h);
    if (hashes.has(key)) return false;
    hashes.add(key);
  }
  return hashes.size === poses.length;
}

export async function submitFaceLiveness(
  poses: { pose: FaceLivenessPose; dataUrl: string }[],
): Promise<{ error?: string; verified?: boolean; schemaSync?: boolean; poseCount?: number }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const byPose = new Map<FaceLivenessPose, string>();
  for (const p of poses) {
    if (!REQUIRED_POSES.includes(p.pose)) {
      return { error: `Invalid pose: ${p.pose}` };
    }
    if (!isValidCaptureDataUrl(p.dataUrl)) {
      return { error: `Invalid capture for pose ${p.pose}. Retake with camera active.` };
    }
    byPose.set(p.pose, p.dataUrl);
  }

  if (byPose.size < REQUIRED_POSES.length) {
    return { error: "All five poses required: center, up, down, left, right." };
  }

  const ordered = REQUIRED_POSES.map((pose) => ({
    pose,
    dataUrl: byPose.get(pose)!,
  }));

  if (!distinctFrameHashes(ordered)) {
    return { error: "Liveness failed: poses must differ — move your head between captures." };
  }

  let admin: ReturnType<typeof createAdminSupabase>;
  try {
    admin = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    console.error("[verify:liveness] createAdminSupabase failed:", msg);
    return { error: "Server misconfigured. SUPABASE_SERVICE_ROLE_KEY required." };
  }

  const sealedAt = Date.now();
  const uploadedPaths: string[] = [];

  for (const { pose, dataUrl } of ordered) {
    const path = `${user.id}/liveness/${pose}-${sealedAt}.jpg`;
    const base64 = dataUrl.split(",")[1]!;
    const buffer = Buffer.from(base64, "base64");

    const { error: uploadErr } = await admin.storage
      .from("verification-docs")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadErr) {
      console.error("[verify:liveness] storage:", uploadErr.message, uploadErr);
      return { error: uploadErr.message || "Storage upload failed." };
    }
    uploadedPaths.push(path);
  }

  const verifiedAt = new Date().toISOString();
  const profileResult = await adminUpdateProfile(
    user.id,
    {
      face_liveness_verified: true,
      face_liveness_at: verifiedAt,
      face_liveness_pose_count: ordered.length,
    },
    {
      face_liveness_verified: true,
    },
  );

  if (profileResult.error) {
    console.error("[verify:liveness] profile update:", profileResult.error);
    return {
      error: profileResult.error,
      schemaSync: profileResult.schemaSync,
    };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { verified: true, poseCount: ordered.length };
}
