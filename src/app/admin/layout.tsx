import * as React from "react";
import { redirect } from "next/navigation";
import { type NavItem } from "@/components/dashboard/shell";
import { ActivePath } from "@/components/dashboard/active-path";
import {
  getSessionUser,
  requireAdminProfile,
} from "@/lib/supabase/server";

/**
 * /admin/* — Admin scope.
 * -----------------------
 * Two gates apply at the layout level:
 *   1. Authentication via getSessionUser(); unauth → /auth/login
 *   2. Role check via requireAdminProfile(); non-admin → /dashboard
 *
 * Both gates run on the server before any admin component renders, so
 * a curious user can't ever flash the admin chrome by tampering with
 * client-side flags.
 *
 * Note: NavItem.icon is a string key (resolved client-side in the shell),
 * because Lucide icon components cannot cross the server→client boundary.
 */

const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "layout-dashboard" },
  { href: "/admin/threats", label: "Global threats", icon: "shield-alert" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/system", label: "System health", icon: "activity" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin");

  const profile = await requireAdminProfile();
  if (!profile) redirect("/dashboard");

  const shellUser = {
    email: user.email ?? "",
    fullName: profile.full_name ?? user.user_metadata?.full_name ?? null,
    role: profile.role,
  };

  return (
    <ActivePath nav={adminNav} user={shellUser} scope="admin">
      {children}
    </ActivePath>
  );
}
