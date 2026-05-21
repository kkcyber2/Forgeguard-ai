import * as React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ActivePath } from "@/components/dashboard/active-path";
import {
  buildDashboardNav,
  isPathAllowed,
  redirectForBlockedPath,
  resolveAccessRank,
  type UserType,
} from "@/lib/access/ranks";
import {
  getSessionUser,
  getCurrentProfile,
  createServerSupabase,
} from "@/lib/supabase/server";

/**
 * Authenticated dashboard shell — Stronghold 2.0 top navigation.
 *
 * Access tiers (profiles.access_level → rank):
 *   1–2 Recruit     → Overview, Scans (+ client: Aegis, Bounties)
 *   3–4 Ghost/Sentinel → + Forge, Bazaar, Missions (hackers), Intel, Repos
 *   5 Legend        → Admin panel + Global threat map
 *
 * user_type prioritizes nav order:
 *   client → Aegis, Bounties first
 *   hacker → Missions, Forge first
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();

  const rawAccessLevel = profile?.access_level ?? 0;
  if (!rawAccessLevel || rawAccessLevel === 0) {
    redirect("/auth/signup/identity");
  }

  const userType = (profile?.user_type ?? "hacker") as UserType;
  const accessLevel = rawAccessLevel;
  const rank = resolveAccessRank(accessLevel, profile?.role ?? null);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (!isPathAllowed(pathname, rank, userType)) {
    redirect(redirectForBlockedPath(pathname));
  }

  const supabase = await createServerSupabase();
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_usd, is_frozen")
    .eq("user_id", user.id)
    .maybeSingle();

  const userNav = buildDashboardNav(accessLevel, userType, profile?.role ?? null);

  const shellUser = {
    email: user.email ?? "",
    fullName:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    role: profile?.role ?? "user",
    hackerRank: profile?.hacker_rank ?? "RECRUIT",
    walletBalance: Number(wallet?.balance_usd ?? 0),
    walletFrozen: wallet?.is_frozen ?? false,
    identityVerified: profile?.identity_verified ?? false,
    companyTag: profile?.company_tag ?? null,
    domainVerified: profile?.domain_verified ?? false,
  };

  return (
    <ActivePath nav={userNav} user={shellUser} scope="user">
      {children}
    </ActivePath>
  );
}
