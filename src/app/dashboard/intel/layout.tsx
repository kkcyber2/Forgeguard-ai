/**
 * /dashboard/intel layout — server-side identity gate.
 *
 * Intel Hub (community chat + live threat feed) is restricted to
 * access_level ≥ 2 (Hacker / Developer).
 *
 * Redirects to /dashboard?gate=intel so the overview can show an
 * appropriate upgrade prompt without leaking route internals.
 */

import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function IntelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;

  if (accessLevel < 2) {
    redirect("/dashboard?gate=intel");
  }

  return <>{children}</>;
}
