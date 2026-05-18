"use server";

import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type LegalIntensity = "high" | "nuclear";

export interface LegalAuthResult {
  ok: boolean;
  authId?: string;
  error?: string;
}

export async function submitLegalAuthorization(
  fullName: string,
  intensity: LegalIntensity,
): Promise<LegalAuthResult> {
  // ── Auth check ───────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized — session expired." };
  }

  if (!fullName || fullName.trim().length < 2) {
    return { ok: false, error: "Legal name is required." };
  }

  // ── Capture request metadata ─────────────────────────────────────────
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const userAgent = headersList.get("user-agent") ?? "unknown";

  // ── Write via admin client (bypasses RLS) ────────────────────────────
  const admin = createAdminSupabase();
  const { data, error: insertError } = await admin
    .from("legal_authorizations")
    .insert({
      user_id:    user.id,
      scan_id:    null,            // scan_id bound later when scan is created
      full_name:  fullName.trim(),
      ip_address: ip,
      user_agent: userAgent,
      intensity,
      consented:  true,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[legal-auth] insert failed:", insertError.message);
    return { ok: false, error: "Authorization record failed. Try again." };
  }

  return { ok: true, authId: data.id };
}
