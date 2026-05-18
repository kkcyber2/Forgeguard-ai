import * as React from "react";
import { redirect } from "next/navigation";
import { type NavItem } from "@/components/dashboard/shell";
import { ActivePath } from "@/components/dashboard/active-path";
import {
  getSessionUser,
  getCurrentProfile,
} from "@/lib/supabase/server";

/**
 * Authenticated user dashboard shell.
 * Uses Supabase SSR session — anything RLS-protected downstream is
 * automatically scoped to auth.uid().
 *
 * Access tiers (profiles.access_level):
 *   1 = Client    → Overview, Scans, Bounties, Billing, Settings
 *   2 = Hacker    → + Forge, Intel Hub
 *   3 = Developer → + Scheduled (everything)
 *
 * Note: NavItem.icon is a string key (resolved client-side in the shell),
 * because functions cannot cross the server→client component boundary.
 */

// All possible nav items with the minimum access_level required to see them.
const ALL_NAV: Array<NavItem & { minLevel: number }> = [
  { href: "/dashboard",              label: "Overview",    icon: "layout-dashboard", minLevel: 1 },
  { href: "/dashboard/scans",        label: "Scans",       icon: "radar",            minLevel: 1 },
  { href: "/dashboard/forge",        label: "Forge",       icon: "flask-conical",    minLevel: 2 },
  { href: "/dashboard/aegis",         label: "Aegis",       icon: "shield-check",     minLevel: 1 },
  { href: "/dashboard/bounties",     label: "Bounties",    icon: "shield-alert",     minLevel: 1 },
  { href: "/dashboard/bazaar",        label: "Bazaar",      icon: "store",            minLevel: 2 },
  { href: "/dashboard/repos",        label: "Repos",       icon: "git-branch",       minLevel: 2 },
  { href: "/dashboard/intel",        label: "Intel Hub",   icon: "globe",            minLevel: 2 },
  { href: "/dashboard/scheduled",    label: "Scheduled",   icon: "calendar-clock",   minLevel: 3 },
  { href: "/dashboard/billing",      label: "Billing",     icon: "credit-card",      minLevel: 1 },
  { href: "/dashboard/settings",     label: "Settings",    icon: "settings",         minLevel: 1 },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();

  // Default to access_level 1 (client) if the column isn't set yet.
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;

  // Filter nav to items the current identity tier may see.
  const userNav: NavItem[] = ALL_NAV
    .filter(item => accessLevel >= item.minLevel)
    // Strip the internal minLevel field — NavItem doesn't include it.
    .map(({ minLevel: _lvl, ...item }) => item);

  const shellUser = {
    email: user.email ?? "",
    fullName:
      (profile?.full_name as string | undefined) ??
      (user.user_metadata?.full_name as string | unde