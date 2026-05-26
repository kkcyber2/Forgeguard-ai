/**
 * Parallel Sovereignty — context-aware dashboard environments.
 * Client (Electric Purple) · Hacker (Acid Green) · Dev (Sovereign console).
 */

import type { NavItem } from "@/components/dashboard/shell";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { resolveTrustLevelFromHackerRank } from "@/lib/access/trust-score";
import {
  type UserType,
  resolveAccessRank,
  isPathAllowed,
  redirectForBlockedPath,
} from "@/lib/access/ranks";

export type ViewMode = "client" | "hacker";
export type SovereignRole = "client" | "hacker" | "dev";

export const SOVEREIGN_ACCENTS: Record<
  SovereignRole,
  { primary: string; glow: string; label: string }
> = {
  client: {
    primary: "#A020F0",
    glow: "rgba(160,32,240,0.35)",
    label: "Client Sovereign",
  },
  hacker: {
    primary: "#ADFF2F",
    glow: "rgba(173,255,47,0.35)",
    label: "Hacker Sovereign",
  },
  dev: {
    primary: "#D1FF00",
    glow: "rgba(209,255,0,0.35)",
    label: "Dev Sovereign",
  },
};

/** @deprecated Use SOVEREIGN_ACCENTS */
export const VIEW_MODE_ACCENTS: Record<
  ViewMode,
  { primary: string; glow: string; label: string }
> = {
  client: SOVEREIGN_ACCENTS.client,
  hacker: SOVEREIGN_ACCENTS.hacker,
};

const ACCOUNT_NAV: NavItem[] = [
  { href: "/dashboard/billing", label: "Billing", icon: "credit-card", section: "Account" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", section: "Account" },
];

/** Secondary nav — rank-gated overflow items */
const SECONDARY_NAV: Array<NavItem & { minRank: number; viewModes?: ViewMode[] }> = [
  { href: "/dashboard/scans", label: "Scans", icon: "radar", section: "Operations", minRank: 1 },
  { href: "/dashboard/repos", label: "Repository", icon: "git-branch", section: "Operations", minRank: 3, viewModes: ["hacker"] },
  { href: "/dashboard/intel", label: "Intel", icon: "zap", section: "Operations", minRank: 3 },
  { href: "/dashboard/analytics", label: "Analytics", icon: "activity", section: "Operations", minRank: 2 },
  { href: "/dashboard/recon", label: "Recon Map", icon: "globe", section: "Stronghold", minRank: 4 },
  { href: "/dashboard/scheduled", label: "Scheduled", icon: "calendar-clock", section: "Operations", minRank: 4 },
  { href: "/dashboard/missions", label: "Mission Feed", icon: "crosshair", section: "Operations", minRank: 1, viewModes: ["client"] },
];

const LEGEND_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: "shield-alert", section: "Legend" },
  { href: "/admin/threats", label: "Global Map", icon: "globe", section: "Legend" },
];

/** Admin Command Center nav — DEV persona */
export function buildDevNav(): { primary: NavItem[]; secondary: NavItem[] } {
  const primary: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "layout-dashboard", section: "Command" },
    { href: "/admin/threats", label: "Global threats", icon: "shield-alert", section: "Command" },
    { href: "/admin/bazaar", label: "Bazaar Triage", icon: "store", section: "Command" },
    { href: "/admin/bazaar/verified", label: "Verified Catalog", icon: "shield-check", section: "Command" },
    { href: "/admin/ledger", label: "Financial Ledger", icon: "landmark", section: "Command" },
  ];
  const secondary: NavItem[] = [
    { href: "/admin/bounties", label: "Bounty Escrow", icon: "credit-card", section: "Ops" },
    { href: "/admin/users", label: "Users", icon: "users", section: "Ops" },
    { href: "/admin/verification", label: "Verification", icon: "shield-check", section: "Ops" },
    { href: "/admin/system", label: "System health", icon: "activity", section: "Ops" },
    { href: "/admin/settings", label: "Settings", icon: "settings", section: "Account" },
  ];
  return { primary, secondary };
}

/** Primary nav per Genesis 3.0 spec */
export function buildSovereignNav(
  viewMode: ViewMode,
  accessLevel: number,
  userType: UserType,
  role: string | null,
): { primary: NavItem[]; secondary: NavItem[] } {
  const rank = resolveAccessRank(accessLevel, role);

  const primary: NavItem[] =
    viewMode === "client"
      ? [
          { href: "/dashboard", label: "Overview", icon: "layout-dashboard", section: "Stronghold" },
          { href: "/dashboard/analytics", label: "Analytics", icon: "activity", section: "Operations" },
          { href: "/dashboard/aegis", label: "Aegis Shield", icon: "shield-check", section: "Operations" },
          { href: "/dashboard/bounties", label: "Bounty Management", icon: "shield-alert", section: "Operations" },
          { href: "/dashboard/scans", label: "Financial Risk", icon: "radar", section: "Operations" },
        ]
      : [
          { href: "/dashboard", label: "Overview", icon: "layout-dashboard", section: "Stronghold" },
          { href: "/dashboard/analytics", label: "Analytics", icon: "activity", section: "Operations" },
          { href: "/dashboard/missions", label: "Mission Feed", icon: "crosshair", section: "Stronghold" },
          { href: "/dashboard/forge", label: "The Forge", icon: "flask-conical", section: "Stronghold" },
          { href: "/dashboard/bazaar", label: "Bazaar", icon: "store", section: "Operations" },
        ];

  const filteredPrimary = primary
    .map((item) => ({
      ...item,
      locked:
        viewMode === "hacker" &&
        item.href === "/dashboard/forge" &&
        rank < 3,
    }))
    .filter((item) => {
      if (item.locked) return true;
      return isPathAllowed(item.href, rank, userType);
    });

  const secondary = SECONDARY_NAV.filter((item) => {
    if (rank < item.minRank) return false;
    if (item.viewModes && !item.viewModes.includes(viewMode)) return false;
    if (viewMode === "client" && item.href === "/dashboard/scans") return false;
    if (viewMode === "hacker" && item.href === "/dashboard/missions") return false;
    return isPathAllowed(item.href, rank, userType);
  }).map(({ minRank: _r, viewModes: _v, ...item }) => item);

  const secondaryNav = [...secondary, ...ACCOUNT_NAV];
  if (rank >= 5) {
    secondaryNav.push(...LEGEND_NAV);
  }

  return { primary: filteredPrimary, secondary: secondaryNav };
}

/** @deprecated Use buildSovereignNav */
export function buildParallelNav(viewMode: ViewMode): NavItem[] {
  return buildSovereignNav(viewMode, 5, viewMode === "client" ? "client" : "hacker", null).primary.concat(
    ACCOUNT_NAV,
  );
}

export function resolveViewMode(
  activeViewMode: string | null | undefined,
  userType: string | null | undefined,
): ViewMode {
  if (activeViewMode === "client" || activeViewMode === "hacker") {
    return activeViewMode;
  }
  if (userType === "client") return "client";
  return "hacker";
}

export function resolvePersona(
  currentPersona: string | null | undefined,
  activeViewMode: string | null | undefined,
  userType: string | null | undefined,
): SovereignRole {
  if (currentPersona === "client" || currentPersona === "hacker" || currentPersona === "dev") {
    return currentPersona;
  }
  return resolveViewMode(activeViewMode, userType);
}

export function personaToViewMode(role: SovereignRole): ViewMode {
  return role === "client" ? "client" : "hacker";
}

export function canAccessDevMode(
  clearanceTier: string | null | undefined,
  role: string | null | undefined,
  email?: string | null,
): boolean {
  if (!isSovereignOperator(email)) return false;
  return clearanceTier === "sovereign" && role === "admin";
}

export function canShowPersonaSwitcher(
  userType: string | null | undefined,
  clearanceTier: string | null | undefined,
  email?: string | null,
  hackerRank?: string | number | null,
  accessLevel?: number | null,
): boolean {
  if (isSovereignOperator(email)) return false;
  const trust = resolveTrustLevelFromHackerRank(hackerRank);
  const level = accessLevel ?? 1;
  return trust >= 2 || level >= 2;
}

export function isPathAllowedForView(
  pathname: string,
  viewMode: ViewMode,
  rank: number,
  userType: UserType = "hacker",
): boolean {
  if (viewMode === "client") {
    const blocked = ["/dashboard/forge", "/dashboard/bazaar", "/dashboard/repos"];
    if (blocked.some((p) => pathname.startsWith(p))) return false;
  }
  if (viewMode === "hacker") {
    const blocked = ["/dashboard/aegis", "/dashboard/bounties"];
    if (blocked.some((p) => pathname.startsWith(p))) return false;
  }
  return isPathAllowed(pathname, rank, userType);
}

export function redirectForViewBlocked(pathname: string, viewMode: ViewMode): string {
  if (viewMode === "client") {
    return pathname.startsWith("/dashboard/forge") ? "/dashboard/scans" : "/dashboard";
  }
  return redirectForBlockedPath(pathname);
}

export function redirectForPersona(role: SovereignRole): "/admin" | "/dashboard" {
  return role === "dev" ? "/admin" : "/dashboard";
}
