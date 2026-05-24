/**
 * Parallel Sovereignty — context-aware dashboard environments.
 * Client workspace (Electric Purple) vs Hacker workspace (Acid Green).
 */

import type { NavItem } from "@/components/dashboard/shell";
import {
  type UserType,
  resolveAccessRank,
  isPathAllowed,
  redirectForBlockedPath,
} from "@/lib/access/ranks";

export type ViewMode = "client" | "hacker";

export const VIEW_MODE_ACCENTS: Record<
  ViewMode,
  { primary: string; glow: string; label: string }
> = {
  client: {
    primary: "#A855F7",
    glow: "rgba(168,85,247,0.35)",
    label: "Client Sovereign",
  },
  hacker: {
    primary: "#D1FF00",
    glow: "rgba(209,255,0,0.35)",
    label: "Hacker Sovereign",
  },
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
  { href: "/dashboard/recon", label: "Recon Map", icon: "globe", section: "Stronghold", minRank: 4 },
  { href: "/dashboard/scheduled", label: "Scheduled", icon: "calendar-clock", section: "Operations", minRank: 4 },
  { href: "/dashboard/missions", label: "Mission Feed", icon: "crosshair", section: "Operations", minRank: 1, viewModes: ["client"] },
];

const LEGEND_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: "shield-alert", section: "Legend" },
  { href: "/admin/threats", label: "Global Map", icon: "globe", section: "Legend" },
];

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
          { href: "/dashboard/aegis", label: "Aegis Shield", icon: "shield-check", section: "Operations" },
          { href: "/dashboard/bounties", label: "Bounty Management", icon: "shield-alert", section: "Operations" },
          { href: "/dashboard/scans", label: "Financial Risk", icon: "radar", section: "Operations" },
        ]
      : [
          { href: "/dashboard", label: "Overview", icon: "layout-dashboard", section: "Stronghold" },
          { href: "/dashboard/missions", label: "Mission Feed", icon: "crosshair", section: "Stronghold" },
          { href: "/dashboard/forge", label: "The Forge", icon: "flask-conical", section: "Stronghold" },
          { href: "/dashboard/bazaar", label: "Bazaar", icon: "store", section: "Operations" },
        ];

  const filteredPrimary = primary.filter((item) =>
    isPathAllowed(item.href, rank, userType),
  );

  const secondary = SECONDARY_NAV.filter((item) => {
    if (rank < item.minRank) return false;
    if (item.viewModes && !item.viewModes.includes(viewMode)) return false;
    if (viewMode === "client" && item.href === "/dashboard/scans") return false;
    if (viewMode === "hacker" && item.href === "/dashboard/missions") return false;
    return isPathAllowed(item.href, rank, userType);
  }).map(({ minRank: _r, viewModes: _v, ...item }) => item);

  const nav = [...filteredPrimary, ...secondary, ...ACCOUNT_NAV];

  if (rank >= 5) {
    nav.push(...LEGEND_NAV);
  }

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

export function redirectForViewBlocked(pathname: string, _viewMode: ViewMode): string {
  return redirectForBlockedPath(pathname);
}
