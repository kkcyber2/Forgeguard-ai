"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, type NavItem, type ShellUser } from "@/components/dashboard/shell";
import { SovereignProvider } from "@/components/dashboard/sovereign-provider";
import type { SovereignHydratePayload } from "@/stores/use-sovereign-store";
import {
  personaToViewMode,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";

export function ActivePath({
  nav,
  primaryNav,
  secondaryNav,
  user,
  scope,
  viewMode,
  sovereign,
  identityChosen,
  canSwitchIdentity,
  children,
}: {
  nav: NavItem[];
  primaryNav?: NavItem[];
  secondaryNav?: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  viewMode?: ViewMode;
  sovereign?: SovereignHydratePayload;
  identityChosen?: boolean;
  canSwitchIdentity?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const resolvedViewMode =
    viewMode ?? (sovereign ? personaToViewMode(sovereign.activeRole) : "hacker");

  const shell = (
    <DashboardShell
      nav={nav}
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      user={user}
      scope={scope}
      activePath={pathname}
      viewMode={resolvedViewMode}
      sovereignRole={sovereign?.activeRole}
      identityChosen={identityChosen ?? true}
      canSwitchIdentity={canSwitchIdentity ?? sovereign?.canSwitch ?? false}
    >
      {children}
    </DashboardShell>
  );

  if (!sovereign) return shell;

  return <SovereignProvider initial={sovereign}>{shell}</SovereignProvider>;
}
