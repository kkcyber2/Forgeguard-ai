"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardShell, type NavItem, type ShellUser } from "@/components/dashboard/shell";

/**
 * Tiny client-only helper that feeds the current pathname back into
 * the server-rendered shell. Keeps the shell itself fully server-safe
 * so user + role data never leak into the client bundle.
 */
export function ActivePath({
  nav,
  user,
  scope,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <DashboardShell
      nav={nav}
      user={user}
      scope={scope}
      activePath={pathname}
    >
      {children}
    </DashboardShell>
  );
}
