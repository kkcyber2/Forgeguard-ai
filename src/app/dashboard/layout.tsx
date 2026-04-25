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
 * Note: NavItem.icon is a string key (resolved client-side in the shell),
 * because functions cannot cross the server→client component boundary.
 */

const userNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "layout-dashboard" },
  { href: "/dashboard/scans", label: "Scans", icon: "radar" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();
  const shellUser = {
    email: user.email ?? "",
    fullName:
      (profile?.full_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    role: (profile?.role as string | undefined) ?? "user",
  };

  return (
    <ActivePath nav={userNav} user={shellUser} scope="user">
      {children}
    </ActivePath>
  );
}
