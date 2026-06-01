import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_VERSION,
} from "@/services/compliance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingCookieColumn(err: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    msg.includes("cookie_consent_at") ||
    msg.includes("cookie_consent_version") ||
    msg.includes("schema cache")
  );
}

/**
 * POST /api/compliance/cookie-consent
 * Records essential cookie consent on profiles or guest cookie.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const now = new Date().toISOString();
    let profileWarning: string | undefined;

    if (user) {
      try {
        const admin = createAdminSupabase();
        const { error } = await admin
          .from("profiles")
          .update({
            cookie_consent_at: now,
            cookie_consent_version: COOKIE_CONSENT_VERSION,
          })
          .eq("id", user.id);

        if (error) {
          if (isMissingCookieColumn(error)) {
            profileWarning =
              "cookie_consent_at column missing — apply migration 20260603_genesis30_compliance.sql";
            console.warn("[cookie-consent]", profileWarning);
          } else {
            console.error("[cookie-consent] profile update failed:", error.message);
            return NextResponse.json(
              { error: "Failed to record consent" },
              { status: 500 },
            );
          }
        }
      } catch (adminErr) {
        const msg =
          adminErr instanceof Error ? adminErr.message : "Admin client unavailable";
        console.error("[cookie-consent] admin update:", msg);
        if (msg.toLowerCase().includes("service_role")) {
          profileWarning = "Profile consent not persisted — SUPABASE_SERVICE_ROLE_KEY unset";
        } else {
          return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
        }
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

    return NextResponse.json({
      ok: true,
      version: COOKIE_CONSENT_VERSION,
      ...(profileWarning ? { warning: profileWarning } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cookie-consent] unhandled:", message);

    if (isMissingCookieColumn({ message })) {
      try {
        const jar = await cookies();
        jar.set(COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_VERSION, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      } catch {
        /* guest cookie best-effort */
      }
      return NextResponse.json({
        ok: true,
        version: COOKIE_CONSENT_VERSION,
        warning:
          "cookie_consent_at column missing — apply migration 20260603_genesis30_compliance.sql",
      });
    }

    return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
  }
}
