import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { ActivePath } from "@/components/dashboard/active-path";
import {
  buildDevNav,
  buildSovereignMasterNav,
  canAccessDevMode,
} from "@/lib/access/parallel-sovereignty";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import {
  getSessionUser,
  requireAdminProfile,
} from "@/lib/supabase/server";

/**
 * /admin/* — Admin scope (DEV persona).
 */

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin");

  const profile = await requireAdminProfile();
  if (!profile) redirect("/dashboard");

  const canDev = canAccessDevMode(profile.clearance_tier, profile.role, user.email);
  const canSwitchIdentity = false;
  const sovereign = isSovereignOperator(user.email);
  const { primary, secondary } = sovereign
    ? buildSovereignMasterNav()
    : buildDevNav();

  const shellUser = {
    email: user.email ?? "",
    fullName: profile.full_name ?? user.user_metadata?.full_name ?? null,
    role: profile.role,
  };

  return (
    <ActivePath
      primaryNav={primary}
      secondaryNav={secondary}
      nav={[...primary, ...secondary]}
      user={shellUser}
      scope="admin"
      sovereign={{
        activeRole: "dev",
        clearanceTier: profile.clearance_tier ?? null,
        canDev,
        canSwitch: canSwitchIdentity,
        isGhostMode: false,
        canGhost: false,
        operatorId: "",
      }}
      canSwitchIdentity={canSwitchIdentity}
    >
      {children}
    </ActivePath>
  );
}
