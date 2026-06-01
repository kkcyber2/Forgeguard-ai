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

const MIGRATION_WARNING =
  "cookie_consent_at column missing — apply migration 20260603_genesis30_compliance.sql";

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

async function setGuestConsentCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_VERSION, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function okResponse(warning?: string) {
  return NextResponse.json({
    ok: true,
    version: COOKIE_CONSENT_VERSION,
    ...(warning ? { warning } : {}),
  });
}

/**
 * POST /api/compliance/cookie-consent
 * Records essential cookie consent on profiles or guest cookie.
 */
export async function POST(_request: NextRequest) {
  let profileWarning: string | undefined;

  try {
    await setGuestConsentCookie();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[cookie-consent] guest cookie:", msg);
  }

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return okResponse();
    }

    try {
      const admin = createAdminSupabase();

      const { data: existing, error: readErr } = await admin
        .from("profiles")
        .select("cookie_consent_at, cookie_consent_version")
        .eq("id", user.id)
        .maybeSingle();

      if (readErr) {
        if (isMissingCookieColumn(readErr)) {
          profileWarning = MIGRATION_WARNING;
          console.warn("[cookie-consent]", profileWarning);
          return okResponse(profileWarning);
        }
        console.error("[cookie-consent] profile read:", readErr.message);
        return okResponse(
          "Profile consent not persisted — database read failed; guest cookie set.",
        );
      }

      if (existing?.cookie_consent_at) {
        return okResponse();
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await admin
        .from("profiles")
        .update({
          cookie_consent_at: now,
          cookie_consent_version: COOKIE_CONSENT_VERSION,
        })
        .eq("id", user.id);

      if (updateErr) {
        if (isMissingCookieColumn(updateErr)) {
          profileWarning = MIGRATION_WARNING;
          console.warn("[cookie-consent]", profileWarning);
          return okResponse(profileWarning);
        }
        console.error("[cookie-consent] profile update:", updateErr.message);
        return okResponse(
          "Profile consent not persisted — update failed; guest cookie set.",
        );
      }
    } catch (adminErr) {
      const msg =
        adminErr instanceof Error ? adminErr.message : "Admin client unavailable";
      console.error("[cookie-consent] admin:", msg);
      if (msg.toLowerCase().includes("service_role")) {
        profileWarning =
          "Profile consent not persisted — SUPABASE_SERVICE_ROLE_KEY unset";
      } else if (isMissingCookieColumn({ message: msg })) {
        profileWarning = MIGRATION_WARNING;
      } else {
        profileWarning = "Profile consent not persisted; guest cookie set.";
      }
      return okResponse(profileWarning);
    }

    return okResponse(profileWarning);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cookie-consent] unhandled:", message);

    if (isMissingCookieColumn({ message })) {
      try {
        await setGuestConsentCookie();
      } catch {
        /* best-effort */
      }
      return okResponse(MIGRATION_WARNING);
    }

    try {
      await setGuestConsentCookie();
      return okResponse("Consent recorded via cookie only; server error on profile update.");
    } catch {
      return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
    }
  }
}
