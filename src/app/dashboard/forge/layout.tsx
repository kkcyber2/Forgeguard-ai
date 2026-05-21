/**
 * /dashboard/forge layout — server-side rank gate (Stronghold 2.0).
 * Forge unlocks at rank 3+ (Ghost/Sentinel). API routes enforce the same gate.
 */

import * as React from "react";
import { redirect } from "next/navigation";
import { isPathAllowed, resolveAccessRank } from "@/lib/access/ranks";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/server";

export default async function ForgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/forge");

  const profile = await getCurrentProfile();
  const rank = resolveAccessRank(profile?.access_level ?? 1, profile?.role ?? null);
  const userType = profile?.user_type ?? "hacker";

  if (!isPathAllowed("/dashboard/forge", rank, userType)) {
    redirect("/dashboard?gate=forge");
  }

  return <>{children}</>;
}
