import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_VERSION,
} from "@/services/compliance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/compliance/cookie-consent
 * Records essential cookie consent on profiles or guest cookie.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();

  if (user) {
    const { error } = await supabase
      .from("profiles")
      .update({
        cookie_consent_at: now,
        cookie_consent_version: COOKIE_CONSENT_VERSION,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[cookie-consent] profile update failed:", error.message);
      return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
    }
  }

  const jar = await cookies();
  jar.set(COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_VERSION, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, version: COOKIE_CONSENT_VERSION });
}
