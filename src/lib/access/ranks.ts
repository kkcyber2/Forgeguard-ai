/**
 * Stronghold 2.0 — Sovereign access tiers.
 *
 * Rank 1–2 (Recruit): Overview + Scans (+ client ops: Aegis, Bounties)
 * Rank 3–4 (Ghost/Sentinel): + Forge, Bazaar, Missions, Intel, Repos, Recon
 * Rank 5 (Legend): + Admin panel, Global threat map
 */

export type UserType = "client" | "hacker" | "developer";

export interface NavAccessItem {
  href: string;
  label: string;
  icon: import("@/components/dashboard/shell").NavIconName;
  section?: string;
  minRank: number;
  /** When set, only shown for this user_type (plus admins) */
  userTypes?: UserType[];
}

export const DASHBOARD_NAV: NavAccessItem[] = [
  { href: "/dashboard", label: "Overview", icon: "layout-dashboard", section: "Stronghold", minRank: 1 },
  { href: "/dashboard/scans", label: "Scans", icon: "radar", section: "Stronghold", minRank: 1 },
  { href: "/dashboard/missions", label: "Missions", icon: "crosshair", section: "Stronghold", minRank: 3 },
  { href: "/dashboard/aegis", label: "Aegis", icon: "shield-check", section: "Operations", minRank: 1, userTypes: ["client", "developer"] },
  { href: "/dashboard/bounties", label: "Bounties", icon: "shield-alert", section: "Operations", minRank: 1, userTypes: ["client", "developer"] },
  { href: "/dashboard/forge", label: "Forge", icon: "flask-conical", section: "Stronghold", minRank: 3, userTypes: ["hacker", "developer"] },
  { href: "/dashboard/bazaar", label: "Bazaar", icon: "store", section: "Operations", minRank: 3 },
  { href: "/dashboard/intel", label: "Intel", icon: "zap", section: "Operations", minRank: 3 },
  { href: "/dashboard/repos", label: "Repos", icon: "git-branch", section: "Operations", minRank: 3 },
  { href: "/dashboard/recon", label: "Recon", icon: "globe", section: "Stronghold", minRank: 4 },
  { href: "/dashboard/scheduled", label: "Scheduled", icon: "calendar-clock", section: "Operations", minRank: 4 },
  { href: "/dashboard/billing", label: "Billing", icon: "credit-card", section: "Account", minRank: 1 },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", section: "Account", minRank: 1 },
];

/** Paths that require rank ≥ 3 */
const RANK_3_PREFIXES = [
  "/dashboard/forge",
  "/dashboard/bazaar",
  "/dashboard/missions",
  "/dashboard/intel",
  "/dashboard/repos",
];

/** Paths that require rank ≥ 4 */
const RANK_4_PREFIXES = ["/dashboard/recon", "/dashboard/scheduled"];

/** Paths that require rank ≥ 5 (Legend) */
const RANK_5_PREFIXES = ["/admin"];

export function resolveAccessRank(accessLevel: number, role: string | null): number {
  if (role === "admin") return 5;
  return Math.max(1, Math.min(5, accessLevel));
}

export function buildDashboardNav(
  accessLevel: number,
  userType: UserType,
  role: string | null,
): import("@/components/dashboard/shell").NavItem[] {
  const rank = resolveAccessRank(accessLevel, role);

  const items = DASHBOARD_NAV.filter((item) => {
    if (item.href === "/dashboard/missions") {
      if (userType === "client") return rank >= 1;
      return rank >= 3;
    }
    if (rank < item.minRank) return false;
    if (item.userTypes) return item.userTypes.includes(userType);
    return true;
  });

  // Client: surface Aegis + Bounties before hacker tools
  if (userType === "client") {
    const order = [
      "/dashboard",
      "/dashboard/scans",
      "/dashboard/aegis",
      "/dashboard/bounties",
      "/dashboard/missions",
    ];
    items.sort((a, b) => {
      const ai = order.indexOf(a.href);
      const bi = order.indexOf(b.href);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  // Hacker: Missions + Forge first after core
  if (userType === "hacker" || userType === "developer") {
    const order = [
      "/dashboard",
      "/dashboard/scans",
      "/dashboard/missions",
      "/dashboard/forge",
      "/dashboard/bazaar",
      "/dashboard/intel",
    ];
    items.sort((a, b) => {
      const ai = order.indexOf(a.href);
      const bi = order.indexOf(b.href);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const nav = items.map(({ minRank: _r, userTypes: _u, ...item }) => item);

  if (rank >= 5) {
    nav.push({ href: "/admin", label: "Admin", icon: "shield-alert", section: "Legend" });
    nav.push({ href: "/admin/threats", label: "Global Map", icon: "globe", section: "Legend" });
  }

  return nav;
}

export function isPathAllowed(
  pathname: string,
  rank: number,
  userType: UserType = "hacker",
): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/scans")) {
    return rank >= 1;
  }
  if (pathname.startsWith("/dashboard/missions")) {
    if (userType === "client") return rank >= 1;
    return rank >= 3;
  }
  if (pathname.startsWith("/dashboard/aegis") || pathname.startsWith("/dashboard/bounties")) {
    return rank >= 1;
  }
  if (pathname.startsWith("/dashboard/billing") || pathname.startsWith("/dashboard/settings")) {
    return rank >= 1;
  }
  if (RANK_5_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rank >= 5;
  }
  if (RANK_4_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rank >= 4;
  }
  if (RANK_3_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rank >= 3;
  }
  return rank >= 1;
}

export function redirectForBlockedPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/dashboard";
  if (RANK_3_PREFIXES.some((p) => pathname.startsWith(p))) return "/dashboard";
  return "/dashboard";
}

/** Color-coded hacker rank badge */
export function rankBadgeClass(hackerRank: string | null): string {
  switch ((hackerRank ?? "RECRUIT").toUpperCase()) {
    case "HACKER":
      return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    case "ELITE":
      return "text-[#D1FF00] border-[#D1FF00]/30 bg-[#D1FF00]/10";
    case "TRAITOR":
      return "text-red-400 border-red-400/30 bg-red-400/10";
    default:
      return "text-zinc-400 border-white/15 bg-white/[0.04]";
  }
}
