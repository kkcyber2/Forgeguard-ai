"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, type NavItem, type ShellUser } from "@/components/dashboard/shell";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

export function ActivePath({
  nav,
  primaryNav,
  secondaryNav,
  user,
  scope,
  viewMode,
  identityChosen,
  children,
}: {
  nav: NavItem[];
  primaryNav?: NavItem[];
  secondaryNav?: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  viewMode?: ViewMode;
  identityChosen?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <DashboardShell
      nav={nav}
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      user={user}
      scope={scope}
      activePath={pathname}
      viewMode={viewMode ?? "hacker"}
      identityChosen={identityChosen ?? true}
    >
      {children}
    </DashboardShell>
  );
}
