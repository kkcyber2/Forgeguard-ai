import * as React from "react";
import { TopBar } from "@/components/dashboard/top-bar";
import { SovereignMasterSidebar } from "@/components/dashboard/sovereign-master-sidebar";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { CommandBar } from "@/components/dashboard/command-bar";
import { EngineStatus } from "@/components/dashboard/engine-status";
import { ComplianceChatBubble } from "@/components/dashboard/compliance-chat";
import { DashboardHolographicMonolith } from "@/components/dashboard/holographic-monolith";
import type { SovereignRole, ViewMode } from "@/lib/access/parallel-sovereignty";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  Cpu,
  CalendarClock,
  CreditCard,
  Crosshair,
  FlaskConical,
  GitBranch,
  Globe,
  Landmark,
  LayoutDashboard,
  Radar,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  Swords,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Dashboard shell — Top Navigation Architecture.
 * Sovereign Obsidian aesthetic.
 *
 * NavItem, ShellUser, NAV_ICONS are exported here and consumed by:
 *   - active-path.tsx  (client wrapper that reads usePathname)
 *   - top-bar.tsx      (full-width header client component)
 *   - mobile-nav.tsx   (hamburger drawer for < lg)
 */

export type NavIconName =
  | "layout-dashboard"
  | "radar"
  | "crosshair"
  | "settings"
  | "shield-alert"
  | "shield-check"
  | "users"
  | "activity"
  | "calendar-clock"
  | "credit-card"
  | "flask-conical"
  | "globe"
  | "store"
  | "git-branch"
  | "landmark"
  | "zap"
  | "swords"
  | "book-open"
  | "cpu";

export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  radar: Radar,
  crosshair: Crosshair,
  settings: Settings,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  users: Users,
  activity: Activity,
  "calendar-clock": CalendarClock,
  "credit-card": CreditCard,
  "flask-conical": FlaskConical,
  globe: Globe,
  store: Store,
  "git-branch": GitBranch,
  landmark: Landmark,
  zap: Zap,
  swords: Swords,
  "book-open": BookOpen,
  cpu: Cpu,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  badge?: React.ReactNode;
  /** Section label — kept for mobile-nav grouping */
  section?: string;
  /** When true, item is visible but opens upgrade gate instead of navigating */
  locked?: boolean;
}

export interface ShellUser {
  email: string;
  fullName: string | null;
  role: string | null;
  hackerRank?: string | null;
  walletBalance?: number;
  walletFrozen?: boolean;
  identityVerified?: boolean;
  companyTag?: string | null;
  domainVerified?: boolean;
  trustTier?: import("@/lib/trust/identity").TrustTier;
  trustScore?: number;
}

/* -------------------------------------------------------------------------- */
/* DashboardShell                                                              */
/* -------------------------------------------------------------------------- */

export function DashboardShell({
  children,
  nav,
  primaryNav,
  secondaryNav,
  user,
  scope,
  activePath: _activePath,
  viewMode = "hacker",
  sovereignRole,
  identityChosen = true,
  canSwitchIdentity = false,
  systemDegraded = false,
  wideContent = false,
}: {
  children: React.ReactNode;
  nav: NavItem[];
  primaryNav?: NavItem[];
  secondaryNav?: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  /**
   * @deprecated TopBar reads pathname via usePathname() directly.
   * Kept for backward-compat with ActivePath wrapper.
   */
  activePath?: string;
  viewMode?: ViewMode;
  sovereignRole?: SovereignRole;
  identityChosen?: boolean;
  canSwitchIdentity?: boolean;
  /** Set to true when Railway reports infrastructure degradation. */
  systemDegraded?: boolean;
  /** Wider content area for admin command center. */
  wideContent?: boolean;
}) {
  const sovereignNav = isSovereignOperator(user.email);

  return (
    <div
      className="relative min-h-screen bg-[#050505] text-white transition-colors duration-300"
      suppressHydrationWarning
    >
      {/* Ambient layer — behind top nav (z-0), content above (z-10) */}
      {scope === "user" && <DashboardHolographicMonolith viewMode={viewMode} />}

      <CommandBar viewMode={viewMode} />

      {sovereignNav && <SovereignMasterSidebar email={user.email} />}

      <TopBar
        nav={nav}
        primaryNav={primaryNav}
        secondaryNav={secondaryNav}
        user={user}
        scope={scope}
        viewMode={viewMode}
        sovereignRole={sovereignRole}
        identityChosen={identityChosen}
        canSwitchIdentity={canSwitchIdentity}
        systemDegraded={systemDegraded}
      />

      <main
        className={cn(
          "relative z-10 overflow-x-hidden pt-14",
          sovereignNav && "lg:pl-[220px]",
        )}
        style={{
          paddingTop: systemDegraded
            ? "calc(56px + 28px + env(safe-area-inset-top, 0px))"
            : "calc(3.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <div
          className={
            wideContent
              ? "mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-10"
              : "mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10"
          }
        >
          <EngineStatus />
          <div className="mt-4 rounded-[6px] border-[0.5px] border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:p-6">
            {children}
          </div>
        </div>
      </main>
      {scope === "user" && <ComplianceChatBubble />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PageHeader                                                                  */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-white/40">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
