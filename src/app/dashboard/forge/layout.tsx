/**
 * /dashboard/forge layout — server-side identity gate.
 *
 * The Forge is restricted to access_level ≥ 2 (Hacker / Developer).
 * This layout runs on the server before any child page component is
 * evaluated, so it acts as a hard perimeter guard — the client page
 * never mounts if the tier check fails.
 *
 * Note: the API route (/api/forge/execute) enforces the same gate
 * independently, so there is defence-in-depth even if this layout is
 * somehow bypassed in future routing changes.
 */

import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function ForgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;

  if (accessLevel < 2) {
    // Redirect to dashboard with a query flag so the overview page can
    // surface a contextual "upgrade your identity" banner.
    redirect("/dashboard?gate=forge");
  }

  return <>{children}</>;
}
