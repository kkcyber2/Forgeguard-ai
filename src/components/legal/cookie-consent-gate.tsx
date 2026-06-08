import { cookies } from "next/headers";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { CookieConsent } from "@/components/compliance/cookie-consent";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_VERSION,
} from "@/services/compliance.service";

function profileHasValidConsent(
  profile: { cookie_consent_at?: string | null; cookie_consent_version?: string | null } | null,
): boolean {
  if (!profile?.cookie_consent_at) return false;
  const version = profile.cookie_consent_version ?? COOKIE_CONSENT_VERSION;
  return version === COOKIE_CONSENT_VERSION;
}

/** Server gate: show banner until profile or guest cookie records consent. */
export async function CookieConsentGate() {
  const jar = await cookies();
  const cookieVersion = jar.get(COOKIE_CONSENT_COOKIE)?.value;
  if (cookieVersion === COOKIE_CONSENT_VERSION) {
    return <CookieConsent initialConsented={true} />;
  }

  const user = await getSessionUser();
  if (user) {
    const profile = await getCurrentProfile();
    if (profileHasValidConsent(profile)) {
      return <CookieConsent initialConsented={true} syncProfileConsent />;
    }
  }

  return <CookieConsent initialConsented={false} />;
}
