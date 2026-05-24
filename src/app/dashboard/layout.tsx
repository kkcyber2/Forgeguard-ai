import * as React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ActivePath } from "@/components/dashboard/active-path";
import {
  buildSovereignNav,
  isPathAllowedForView,
  redirectForViewBlocked,
  resolveViewMode,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";
import { resolveAccessRank, type UserType } from "@/lib/access/ranks";
import {
  getSessionUser,
  getCurrentProfile,
  createServerSupabase,
} from "@/lib/supabase/server";

/**
 * Authenticated dashboard shell — Parallel Sovereignty.
 * active_view_mode drives nav, accent, and route guards (client vs hacker).
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();

  if (!profile?.user_type) {
    redirect("/auth/signup/identity");
  }

  const viewMode: ViewMode = resolveViewMode(
    profile.active_view_mode,
    profile.user_type,
  );

  const accessLevel = profile.access_level ?? 1;
  const rank = resolveAccessRank(accessLevel, profile.role ?? null);
  const userType = (profile.user_type ?? "hacker") as UserType;

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (!isPathAllowedForView(pathname, viewMode, rank, userType)) {
    redirect(redirectForViewBlocked(pathname, viewMode));
  }

  const supabase = await createServerSupabase();
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_usd, is_frozen")
    .eq("user_id", user.id)
    .maybeSingle();

  const { primary, secondary } = buildSovereignNav(
    viewMode,
    accessLevel,
    userType,
    profile.role ?? null,
  );

  const shellUser = {
    email: user.email ?? "",
    fullName:
      profile.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    role: profile.role ?? "user",
    hackerRank: profile.hacker_rank ?? "RECRUIT",
    walletBalance: Number(wallet?.balance_usd ?? 0),
    walletFrozen: wallet?.is_frozen ?? false,
    identityVerified: profile.identity_verified ?? false,
    companyTag: profile.company_tag ?? null,
    domainVerified: profile.domain_verified ?? false,
  };

  return (
    <ActivePath
      primaryNav={primary}
      secondaryNav={secondary}
      nav={[...primary, ...secondary]}
      user={shellUser}
      scope="user"
      viewMode={viewMode}
      identityChosen={Boolean(profile.user_type)}
    >
      {children}
    </ActivePath>
  );
}
