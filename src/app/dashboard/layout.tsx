import * as React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ActivePath } from "@/components/dashboard/active-path";
import {
  buildSovereignNav,
  canAccessDevMode,
  canShowPersonaSwitcher,
  isPathAllowedForView,
  personaToViewMode,
  redirectForViewBlocked,
  resolvePersona,
  resolveViewMode,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";
import { canEnableGhostMode, normalizeSubscriptionTier } from "@/lib/access/ghost-mode";
import { resolveAccessRank, type UserType } from "@/lib/access/ranks";
import { computeTrustScore } from "@/lib/access/trust-score";
import {
  getSessionUser,
  getCurrentProfile,
  createServerSupabase,
} from "@/lib/supabase/server";

/**
 * Authenticated dashboard shell — Parallel Sovereignty.
 * current_persona + active_view_mode drive nav, accent, and route guards.
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  let profile = await getCurrentProfile();
  if (!profile) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    profile = await getCurrentProfile();
  }

  if (!profile?.user_type) {
    redirect("/auth/signup/identity");
  }

  const persona = resolvePersona(
    profile.current_persona,
    profile.active_view_mode,
    profile.user_type,
  );

  if (persona === "dev") {
    redirect("/admin");
  }

  const viewMode: ViewMode = resolveViewMode(
    profile.active_view_mode,
    profile.user_type,
  );

  const accessLevel = profile.access_level ?? 1;
  const rank = resolveAccessRank(accessLevel, profile.role ?? null);
  const userType = (profile.user_type ?? "hacker") as UserType;
  const canDev = canAccessDevMode(profile.clearance_tier, profile.role);
  const canSwitchIdentity = canShowPersonaSwitcher(profile.user_type, profile.clearance_tier);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (!isPathAllowedForView(pathname, viewMode, rank, userType)) {
    redirect(redirectForViewBlocked(pathname, viewMode));
  }

  const supabase = await createServerSupabase();
  const [{ data: wallet }, { data: subscription }] = await Promise.all([
    supabase
      .from("user_wallets")
      .select("balance_usd, is_frozen")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const subscriptionPlan =
    subscription?.status === "active" ||
    subscription?.status === "trialing" ||
    subscription?.status === "past_due"
      ? subscription.plan
      : null;

  const subscriptionTier = normalizeSubscriptionTier(
    profile.subscription_tier,
    profile.current_plan,
    subscriptionPlan,
  );

  const canGhost = canEnableGhostMode(
    profile.hacker_rank,
    subscriptionTier,
    profile.access_level,
    profile.current_plan,
    subscriptionPlan,
  );

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
    trustScore: computeTrustScore({
      identityVerified: profile.identity_verified ?? false,
      domainVerified: profile.domain_verified ?? false,
      phoneVerified: profile.phone_verified ?? false,
      auditScore: profile.identity_audit_score
        ? Number(profile.identity_audit_score)
        : null,
    }),
  };

  return (
    <ActivePath
      primaryNav={primary}
      secondaryNav={secondary}
      nav={[...primary, ...secondary]}
      user={shellUser}
      scope="user"
      viewMode={personaToViewMode(persona)}
      sovereign={{
        activeRole: persona,
        clearanceTier: profile.clearance_tier ?? null,
        canDev,
        canSwitch: canSwitchIdentity,
        isGhostMode: profile.is_ghost_active ?? false,
        canGhost,
        operatorId: user.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
      }}
      identityChosen={Boolean(profile.user_type)}
      canSwitchIdentity={canSwitchIdentity}
    >
      {children}
    </ActivePath>
  );
}
