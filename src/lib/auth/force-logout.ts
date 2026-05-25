"use server";

import { redirect } from "next/navigation";
import { SOVEREIGN_VIOLATION_LOGIN } from "@/lib/auth/sovereign-violation";
import { isForbiddenSovereignAccess } from "@/lib/auth/sovereign-access";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SovereignRole } from "@/lib/access/parallel-sovereignty";

export async function forceLogout(): Promise<{ redirectTo: string }> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return { redirectTo: SOVEREIGN_VIOLATION_LOGIN };
}

/** Server Component guard — redirects after clearing session. */
export async function enforceSovereignOrForceLogout(
  email: string | null | undefined,
  persona?: SovereignRole | null,
): Promise<void> {
  if (!isForbiddenSovereignAccess(email, "/admin", persona)) return;
  await forceLogout();
  redirect(SOVEREIGN_VIOLATION_LOGIN);
}
