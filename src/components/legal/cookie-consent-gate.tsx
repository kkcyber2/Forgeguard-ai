import { cookies } from "next/headers";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { COOKIE_CONSENT_COOKIE } from "@/services/compliance.service";

/** Server gate: show banner until profile or guest cookie records consent. */
export async function CookieConsentGate() {
  const jar = await cookies();
  if (jar.get(COOKIE_CONSENT_COOKIE)?.value) {
    return <CookieConsentBanner consented={true} />;
  }

  const user = await getSessionUser();
  if (user) {
    const profile = await getCurrentProfile();
    if (profile?.cookie_consent_at) {
      return <CookieConsentBanner consented={true} />;
    }
  }

  return <CookieConsentBanner consented={false} />;
}
