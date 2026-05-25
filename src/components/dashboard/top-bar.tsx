"use client";

/**
 * TopBar — Full-width top navigation header.
 * Sovereign Obsidian aesthetic — replaces left sidebar on all viewports.
 *
 * Features:
 *  - Nav tabs with animated acid-green underline (framer-motion layoutId)
 *  - Quick Action dropdown: Launch Scan, Top Up Credits, Post Mission
 *  - Dark / Light theme toggle (cookie + documentElement class)
 *  - Railway "System Degraded" banner (optional prop)
 *  - Account overflow menu: Billing + Settings
 */

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  CreditCard,
  Crosshair,
  Moon,
  Settings,
  Sun,
  Swords,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
import { IdentityBadge } from "@/components/dashboard/identity-badge";
import { IdentitySwitcher } from "@/components/dashboard/identity-switcher";
import { WalletCredits } from "@/components/dashboard/wallet-credits";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UpgradeRequiredModal } from "@/components/dashboard/upgrade-required-modal";
import { NAV_ICONS, type NavItem, type ShellUser } from "@/components/dashboard/shell";
import {
  personaToViewMode,
  SOVEREIGN_ACCENTS,
  type SovereignRole,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";
import { useSovereignStore, useSovereignAccent } from "@/stores/use-sovereign-store";
import { GhostProtocolToggle } from "@/components/dashboard/ghost-protocol-toggle";
import { useLiveWallet } from "@/hooks/use-live-wallet";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Account section items — rendered in a right-side user dropdown */
const ACCOUNT_HREFS = new Set([
  "/dashboard/billing",
  "/dashboard/settings",
]);

const QUICK_ACTIONS: {
  label: string;
  icon: typeof Crosshair;
  href: string;
  viewModes: ViewMode[];
}[] = [
  { label: "Launch Scan",    icon: Crosshair,  href: "/dashboard/scans/new", viewModes: ["client", "hacker"] },
  { label: "Top Up Credits", icon: CreditCard, href: "/dashboard/billing",   viewModes: ["client", "hacker"] },
  { label: "Post Mission",   icon: Swords,     href: "/dashboard/missions/new", viewModes: ["hacker"] },
];

/* -------------------------------------------------------------------------- */
/* Theme hook                                                                  */
/* -------------------------------------------------------------------------- */

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Read from cookie; default to dark
    const match = document.cookie.match(/(?:^|;\s*)theme=([^;]+)/);
    const saved = (match?.[1] ?? "dark") as "dark" | "light";
    setTheme(saved);
    document.documentElement.classList.toggle("light-mode", saved === "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
      document.documentElement.classList.toggle("light-mode", next === "light");
      return next;
    });
  }, []);

  return { theme, toggle };
}

/* -------------------------------------------------------------------------- */
/* Quick-action dropdown                                                       */
/* -------------------------------------------------------------------------- */

function QuickActionMenu({
  scope,
  accentHex,
  viewMode,
}: {
  scope: "user" | "admin";
  accentHex: string;
  viewMode: ViewMode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-[3px] border-[0.5px] px-3 font-mono text-[10px] uppercase tracking-widest transition-all duration-150",
          open
            ? scope === "admin"
              ? "border-violet-400/60 bg-violet-400/10 text-violet-300"
              : "text-white"
            : "border-white/[0.12] text-white/50 hover:border-white/25 hover:text-white/80",
        )}
        style={
          open && scope !== "admin"
            ? {
                borderColor: `${accentHex}99`,
                backgroundColor: `${accentHex}18`,
                color: accentHex,
              }
            : undefined
        }
      >
        <Zap size={11} strokeWidth={2} className="flex-shrink-0" />
        <span>Launch</span>
        <ChevronDown
          size={10}
          strokeWidth={2}
          className={cn(
            "flex-shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.1] bg-[#090909]/98 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="p-1.5">
              <p className="px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.25em] text-white/20">
                Quick Actions
              </p>
              {QUICK_ACTIONS.filter((a) => a.viewModes.includes(viewMode)).map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.href}
                    onClick={() => {
                      setOpen(false);
                      router.push(action.href);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[2px] border-[0.5px] border-white/10 bg-white/[0.04]">
                      <Icon size={11} strokeWidth={1.5} className="text-white/50" />
                    </span>
                    <span className="font-mono text-[11px] tracking-wide text-white/70">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Account overflow menu (Billing + Settings + Sign out)                      */
/* -------------------------------------------------------------------------- */

function AccountMenu({
  user,
  scope,
  accountNav,
  pathname,
}: {
  user: ShellUser;
  scope: "user" | "admin";
  accountNav: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initials = getInitials(user.fullName ?? user.email);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-[3px] border-[0.5px] font-mono text-[10px] transition-all duration-150",
          open
            ? "border-white/20 bg-white/[0.08] text-white"
            : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:text-white/80",
        )}
      >
        {initials}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.1] bg-[#090909]/98 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            {/* User info */}
            <div className="border-b-[0.5px] border-white/[0.06] px-3 py-2.5">
              <p className="truncate font-mono text-[11px] tracking-wide text-white/80">
                {user.fullName ?? "Operator"}
              </p>
              <p className="truncate font-mono text-[9px] tracking-wider text-white/30">
                {user.email}
              </p>
            </div>

            {/* Account nav items */}
            <div className="p-1.5">
              {accountNav.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 transition-colors",
                      active
                        ? "bg-white/[0.05] text-white"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/80",
                    )}
                  >
                    <Icon size={12} strokeWidth={1.5} className="flex-shrink-0" />
                    <span className="font-mono text-[11px] tracking-widest uppercase">
                      {item.label}
                    </span>
                    {active && (
                      <span
                        className={cn(
                          "ml-auto h-1 w-1 rounded-full",
                          scope === "admin" ? "bg-violet-400" : "bg-[#D1FF00]",
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Sign out */}
            <div className="border-t-[0.5px] border-white/[0.06] p-1.5">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left font-mono text-[11px] uppercase tracking-widest text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                >
                  Disconnect
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overflow nav menu ("More" button for secondary items)                      */
/* -------------------------------------------------------------------------- */

function OverflowMenu({
  items,
  scope,
  pathname,
  accentHex,
}: {
  items: NavItem[];
  scope: "user" | "admin";
  pathname: string;
  accentHex: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasActive = items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href)),
  );

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative flex h-full items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-full items-center gap-1 px-3.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-150",
          hasActive || open ? "text-white" : "text-white/35 hover:text-white/65",
        )}
      >
        <span>More</span>
        <ChevronDown
          size={10}
          strokeWidth={2}
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
        {(hasActive || open) && (
          <motion.span
            layoutId="nav-underline"
            className="absolute bottom-0 left-0 right-0 h-[1.5px]"
            style={{ backgroundColor: scope === "admin" ? "#A78BFA" : accentHex }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-0 w-48 overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.1] bg-[#090909]/98 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="p-1.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 transition-colors",
                      active
                        ? "bg-white/[0.05] text-white"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/80",
                    )}
                  >
                    <Icon size={12} strokeWidth={1.5} className="flex-shrink-0" />
                    <span className="font-mono text-[11px] tracking-widest uppercase">
                      {item.label}
                    </span>
                    {active && (
                      <span
                        className="ml-auto h-1 w-1 rounded-full"
                        style={{ backgroundColor: scope === "admin" ? "#A78BFA" : accentHex }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main TopBar export                                                          */
/* -------------------------------------------------------------------------- */

export function TopBar({
  nav,
  primaryNav,
  secondaryNav,
  user,
  scope,
  viewMode = "hacker",
  sovereignRole,
  identityChosen = true,
  canSwitchIdentity = false,
  systemDegraded = false,
}: {
  nav: NavItem[];
  primaryNav?: NavItem[];
  secondaryNav?: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  viewMode?: ViewMode;
  sovereignRole?: SovereignRole;
  identityChosen?: boolean;
  canSwitchIdentity?: boolean;
  systemDegraded?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const { theme, toggle: toggleTheme } = useTheme();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockedFeature, setLockedFeature] = useState("The Forge");

  const storeRole = useSovereignStore((s) => s.activeRole);
  const hydrated = useSovereignStore((s) => s.hydrated);
  const storeAccent = useSovereignAccent();

  const activeRole: SovereignRole =
    hydrated ? storeRole : (sovereignRole ?? (scope === "admin" ? "dev" : viewMode));
  const dashboardViewMode = personaToViewMode(activeRole);
  const accent = hydrated ? storeAccent : SOVEREIGN_ACCENTS[activeRole];
  const accentHex = accent.primary;

  const resolvedPrimary = primaryNav ?? nav;
  const resolvedSecondary = secondaryNav ?? [];
  const overflowNav = resolvedSecondary.filter(
    (item) => !ACCOUNT_HREFS.has(item.href),
  );
  const accountNav = nav.filter((item) => ACCOUNT_HREFS.has(item.href));
  const liveWallet = useLiveWallet(user.walletBalance ?? 0);

  return (
    <>
      {upgradeOpen && (
        <UpgradeRequiredModal
          feature={lockedFeature}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
      {/* ── System Degraded Banner ─────────────────────────────────────────── */}
      {systemDegraded && (
        <div className="fixed inset-x-0 top-0 z-50 flex h-7 items-center justify-center gap-2 border-b-[0.5px] border-orange-400/20 bg-[#1a0a00]/90 backdrop-blur-sm">
          <AlertTriangle size={11} strokeWidth={2} className="text-orange-400" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-orange-400/90">
            System Degraded — Railway infrastructure incident in progress
          </span>
        </div>
      )}

      {/* ── Main header ───────────────────────────────────────────────────── */}
      <header
        className={cn(
          "fixed inset-x-0 z-40 flex h-14 items-stretch border-b-[0.5px] border-white/10 bg-[#050505]/80 backdrop-blur-xl",
          systemDegraded ? "top-7" : "top-0",
        )}
      >
        {/* Logo cell */}
        <div className="flex min-w-0 items-center gap-2.5 border-r-[0.5px] border-white/[0.06] px-5">
          {/* Hamburger — mobile only */}
          <div className="shrink-0 md:hidden">
            <MobileNav
              nav={nav}
              user={user}
              scope={scope}
              activePath={pathname}
              viewMode={dashboardViewMode}
              sovereignRole={activeRole}
              canSwitchIdentity={canSwitchIdentity}
            />
          </div>
          <Link href={scope === "admin" ? "/admin" : "/dashboard"} className="flex min-w-0 items-center hover:opacity-80 transition-opacity">
            <Logo accentColor={accentHex} glow={accent.glow} />
          </Link>
          {scope === "admin" && (
            <Badge tone="admin" className="hidden sm:flex">
              Dev
            </Badge>
          )}
        </div>

        {/* Primary nav tabs — desktop only */}
        <nav className="hidden h-full flex-1 items-stretch overflow-x-auto scrollbar-none md:flex">
          {resolvedPrimary.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = NAV_ICONS[item.icon];

            if (item.locked) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setLockedFeature(item.label);
                    setUpgradeOpen(true);
                  }}
                  className="relative flex h-full items-center gap-1.5 px-4 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap text-white/25 transition-colors hover:text-white/45"
                >
                  <Icon size={11} strokeWidth={1.5} className="flex-shrink-0 opacity-50" />
                  <span>{item.label}</span>
                  <span className="rounded-[2px] border border-violet-400/30 px-1 py-0.5 text-[8px] text-violet-300">
                    LOCK
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-full items-center gap-1.5 px-4 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap transition-colors duration-150",
                  active
                    ? "text-white"
                    : "text-white/35 hover:text-white/70",
                )}
              >
                <Icon size={11} strokeWidth={1.5} className="flex-shrink-0" />
                <span>{item.label}</span>

                {/* Animated active underline */}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px]"
                    style={{ backgroundColor: accentHex }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Overflow → "More" */}
          <OverflowMenu
            items={overflowNav}
            scope={scope}
            pathname={pathname}
            accentHex={accentHex}
          />
        </nav>

        <div className="ml-auto flex items-center gap-1.5 border-l-[0.5px] border-white/[0.06] px-3">
          {canSwitchIdentity && (
            <IdentitySwitcher
              activeMode={activeRole}
              canSwitch={canSwitchIdentity}
              operatorEmail={user.email}
            />
          )}

          {scope === "user" && activeRole === "hacker" && (
            <GhostProtocolToggle />
          )}

          {scope === "user" && activeRole !== "dev" && (
            <QuickActionMenu scope={scope} accentHex={accentHex} viewMode={dashboardViewMode} />
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-7 w-7 items-center justify-center rounded-[3px] text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70"
          >
            {theme === "dark" ? (
              <Sun size={13} strokeWidth={1.5} />
            ) : (
              <Moon size={13} strokeWidth={1.5} />
            )}
          </button>

          {/* Identity: rank + wallet (desktop) */}
          <IdentityBadge
            hackerRank={user.hackerRank ?? null}
            walletBalance={user.walletBalance ?? 0}
            wallet={liveWallet}
            walletFrozen={user.walletFrozen}
            identityVerified={user.identityVerified}
            companyTag={user.companyTag}
            domainVerified={user.domainVerified}
            viewMode={dashboardViewMode}
            trustScore={user.trustScore ?? 0}
          />

          {/* Credits wallet — mobile fallback */}
          <div className="sm:hidden">
            <WalletCredits initialBalance={user.walletBalance ?? 0} wallet={liveWallet} />
          </div>

          <div className="mx-0.5 hidden h-5 w-px bg-white/[0.07] sm:block" />

          {/* Account / avatar dropdown */}
          <AccountMenu
            user={user}
            scope={scope}
            accountNav={accountNav}
            pathname={pathname}
          />
        </div>
      </header>
    </>
  );
}
