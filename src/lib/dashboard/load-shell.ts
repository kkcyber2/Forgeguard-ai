import type { NavItem, ShellUser } from "@/components/dashboard/shell";
import type { SovereignHydratePayload } from "@/stores/use-sovereign-store";
import {
  buildSovereignNav,
  canAccessDevMode,
  canShowPersonaSwitcher,
  isPathAllowedForView,
  personaToViewMode,
  redirectForViewBlocked,
  resolvePersona,
  resolveViewMode,
  type SovereignRole,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";
import { canEnableGhostMode, normalizeSubscriptionTier } from "@/lib/access/ghost-mode";
import { resolveAccessRank, type UserType } from "@/lib/access/ranks";
import { resolveTrustLevelFromHackerRank } from "@/lib/access/trust-score";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const MINIMAL_PRIMARY: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "layout-dashboard",
    section: "Stronghold",
  },
];

const MINIMAL_SECONDARY: NavItem[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "settings",
    section: "Account",
  },
];

export interface DashboardShellPayload {
  primaryNav: NavItem[];
  secondaryNav: NavItem[];
  nav: NavItem[];
  user: ShellUser;
  viewMode: ViewMode;
  sovereign: SovereignHydratePayload;
  identityChosen: boolean;
  canSwitchIdentity: boolean;
}

export type DashboardShellLoadResult = {
  degraded: boolean;
  errorMessage?: string;
  pathAllowed: boolean;
  redirectTo?: string;
  payload: DashboardShellPayload;
};

function coerceAccessLevel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function coerceUserType(value: unknown): UserType {
  if (value === "client" || value === "hacker" || value === "developer") {
    return value;
  }
  return "hacker";
}

function coerceString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return String(value);
}

function buildFallbackPayload(
  email: string,
  userId: string,
  viewMode: ViewMode = "hacker",
): DashboardShellPayload {
  return {
    primaryNav: MINIMAL_PRIMARY,
    secondaryNav: MINIMAL_SECONDARY,
    nav: [...MINIMAL_PRIMARY, ...MINIMAL_SECONDARY],
    user: {
      email,
      fullName: null,
      role: "user",
      hackerRank: null,
      walletBalance: 0,
      walletFrozen: false,
      identityVerified: false,
      companyTag: null,
      domainVerified: false,
      trustScore: 0,
    },
    viewMode,
    sovereign: {
      activeRole: viewMode === "client" ? "client" : "hacker",
      clearanceTier: null,
      canDev: false,
      canSwitch: false,
      isGhostMode: false,
      canGhost: false,
      operatorId: userId.replace(/-/g, "").slice(0, 8).toUpperCase(),
    },
    identityChosen: true,
    canSwitchIdentity: false,
  };
}

export async function loadDashboardShell(input: {
  userId: string;
  email: string | null;
  userMetadata?: Record<string, unknown> | null;
  profile: ProfileRow;
  pathname: string;
}): Promise<DashboardShellLoadResult> {
  const email = input.email ?? "";
  const fallback = buildFallbackPayload(email, input.userId);
  const errors: string[] = [];

  let userType: UserType = "hacker";
  let accessLevel = 1;
  let viewMode: ViewMode = "hacker";
  let persona: SovereignRole = "hacker";
  let rank = 1;
  let canDev = false;
  let canSwitchIdentity = false;

  try {
    userType = coerceUserType(input.profile.user_type);
    accessLevel = coerceAccessLevel(input.profile.access_level);
    viewMode = resolveViewMode(
      coerceString(input.profile.active_view_mode),
      userType,
    );
    persona = resolvePersona(
      coerceString(input.profile.current_persona),
      coerceString(input.profile.active_view_mode),
      userType,
    );
    rank = resolveAccessRank(accessLevel, coerceString(input.profile.role));
    canDev = canAccessDevMode(
      coerceString(input.profile.clearance_tier),
      coerceString(input.profile.role),
      input.email,
    );
    canSwitchIdentity = canShowPersonaSwitcher(
      userType,
      coerceString(input.profile.clearance_tier),
      input.email,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "nav segment failed";
    console.error("[dashboard:shell] nav:", msg, err);
    errors.push(`nav: ${msg}`);
  }

  if (!isPathAllowedForView(input.pathname, viewMode, rank, userType)) {
    const payload = safeBuildShellPayload({
      profile: input.profile,
      userId: input.userId,
      email,
      userMetadata: input.userMetadata,
      viewMode,
      persona,
      userType,
      accessLevel,
      canDev,
      canSwitchIdentity,
      walletBalance: 0,
      walletFrozen: false,
      subscriptionPlan: null,
      fallback,
      errors,
    });
    return {
      degraded: errors.length > 0,
      errorMessage: errors.join("; ") || undefined,
      pathAllowed: false,
      redirectTo: redirectForViewBlocked(input.pathname, viewMode),
      payload,
    };
  }

  let walletBalance = 0;
  let walletFrozen = false;
  let subscriptionPlan: string | null = null;

  try {
    const supabase = await createServerSupabase();
    const [{ data: wallet, error: walletErr }, { data: subscription, error: subErr }] =
      await Promise.all([
        supabase
          .from("user_wallets")
          .select("balance_usd, is_frozen")
          .eq("user_id", input.userId)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", input.userId)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (walletErr) {
      console.error("[dashboard:shell] wallet:", walletErr.message);
      errors.push(`wallet: ${walletErr.message}`);
    } else {
      walletBalance = Number(wallet?.balance_usd ?? 0);
      walletFrozen = wallet?.is_frozen ?? false;
    }

    if (subErr) {
      console.error("[dashboard:shell] subscription:", subErr.message);
      errors.push(`subscription: ${subErr.message}`);
    } else {
      subscriptionPlan =
        subscription?.status === "active" ||
        subscription?.status === "trialing" ||
        subscription?.status === "past_due"
          ? subscription.plan
          : null;
    }
  } catch (walletErr) {
    const msg =
      walletErr instanceof Error ? walletErr.message : "wallet segment failed";
    console.error("[dashboard:shell] wallet/subscription:", msg, walletErr);
    errors.push(`wallet: ${msg}`);
  }

  const payload = safeBuildShellPayload({
    profile: input.profile,
    userId: input.userId,
    email,
    userMetadata: input.userMetadata,
    viewMode,
    persona,
    userType,
    accessLevel,
    canDev,
    canSwitchIdentity,
    walletBalance,
    walletFrozen,
    subscriptionPlan,
    fallback,
    errors,
  });

  return {
    degraded: errors.length > 0,
    errorMessage: errors.length > 0 ? errors.join("; ") : undefined,
    pathAllowed: true,
    payload,
  };
}

function safeBuildShellPayload(args: {
  profile: ProfileRow;
  userId: string;
  email: string;
  userMetadata?: Record<string, unknown> | null;
  viewMode: ViewMode;
  persona: SovereignRole;
  userType: UserType;
  accessLevel: number;
  canDev: boolean;
  canSwitchIdentity: boolean;
  walletBalance: number;
  walletFrozen: boolean;
  subscriptionPlan: string | null;
  fallback: DashboardShellPayload;
  errors: string[];
}): DashboardShellPayload {
  try {
    return buildShellPayload(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sovereign segment failed";
    console.error("[dashboard:shell] sovereign:", msg, err);
    args.errors.push(`sovereign: ${msg}`);
    return {
      ...args.fallback,
      user: {
        ...args.fallback.user,
        email: args.email,
        fullName:
          coerceString(args.profile.full_name) ??
          coerceString(args.userMetadata?.full_name) ??
          null,
        walletBalance: args.walletBalance,
        walletFrozen: args.walletFrozen,
      },
    };
  }
}

function buildShellPayload(args: {
  profile: ProfileRow;
  userId: string;
  email: string;
  userMetadata?: Record<string, unknown> | null;
  viewMode: ViewMode;
  persona: SovereignRole;
  userType: UserType;
  accessLevel: number;
  canDev: boolean;
  canSwitchIdentity: boolean;
  walletBalance: number;
  walletFrozen: boolean;
  subscriptionPlan: string | null;
}): DashboardShellPayload {
  const subscriptionTier = normalizeSubscriptionTier(
    coerceString(args.profile.subscription_tier),
    coerceString(args.profile.current_plan),
    args.subscriptionPlan,
  );
  const canGhost = canEnableGhostMode(
    coerceString(args.profile.hacker_rank),
    subscriptionTier,
    args.accessLevel,
    coerceString(args.profile.current_plan),
    args.subscriptionPlan,
  );

  let primary = MINIMAL_PRIMARY;
  let secondary = MINIMAL_SECONDARY;
  try {
    const nav = buildSovereignNav(
      args.viewMode,
      args.accessLevel,
      args.userType,
      coerceString(args.profile.role),
    );
    primary = nav.primary;
    secondary = nav.secondary;
  } catch (err) {
    console.error("[dashboard:shell] buildSovereignNav:", err);
    throw err;
  }

  const fullName =
    coerceString(args.profile.full_name) ??
    coerceString(args.userMetadata?.full_name) ??
    null;

  return {
    primaryNav: primary,
    secondaryNav: secondary,
    nav: [...primary, ...secondary],
    user: {
      email: args.email,
      fullName,
      role: coerceString(args.profile.role) ?? "user",
      hackerRank: coerceString(args.profile.hacker_rank),
      walletBalance: args.walletBalance,
      walletFrozen: args.walletFrozen,
      identityVerified: Boolean(args.profile.identity_verified),
      companyTag: coerceString(args.profile.company_tag),
      domainVerified: Boolean(args.profile.domain_verified),
      trustScore: resolveTrustLevelFromHackerRank(
        coerceString(args.profile.hacker_rank),
      ),
    },
    viewMode: personaToViewMode(args.persona),
    sovereign: {
      activeRole: args.persona,
      clearanceTier: coerceString(args.profile.clearance_tier),
      canDev: args.canDev,
      canSwitch: args.canSwitchIdentity,
      isGhostMode: Boolean(args.profile.is_ghost_active),
      canGhost,
      operatorId: args.userId.replace(/-/g, "").slice(0, 8).toUpperCase(),
    },
    identityChosen: Boolean(args.profile.user_type),
    canSwitchIdentity: args.canSwitchIdentity,
  };
}
