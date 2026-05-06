import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  Radar,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Dashboard shell — Sidebar, Topbar, page wrapper.
 * Used by BOTH /dashboard (user) and /admin (admin). Navigation items
 * are passed in, so the same chrome renders a different information
 * architecture per role.
 *
 * NOTE: the `icon` field on NavItem is a string key, not a component.
 * The shell is rendered inside the ActivePath client wrapper, and React
 * cannot serialize function references across the server→client boundary.
 * We resolve the string to a Lucide component locally via NAV_ICONS.
 */

export type NavIconName =
  | "layout-dashboard"
  | "radar"
  | "settings"
  | "shield-alert"
  | "users"
  | "activity"
  | "calendar-clock";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  radar: Radar,
  settings: Settings,
  "shield-alert": ShieldAlert,
  users: Users,
  activity: Activity,
  "calendar-clock": CalendarClock,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  badge?: React.ReactNode;
}

export interface ShellUser {
  email: string;
  fullName: string | null;
  role: string | null;
}

export function DashboardShell({
  children,
  nav,
  user,
  scope,
  activePath,
}: {
  children: React.ReactNode;
  nav: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  activePath: string;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <Sidebar nav={nav} user={user} scope={scope} activePath={activePath} />
      <Topbar scope={scope} user={user} />
      <main className="lg:pl-60 pt-14 lg:pt-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  nav,
  user,
  scope,
  activePath,
}: {
  nav: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  activePath: string;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-[0.5px] border-white/[0.06] bg-obsidian-950/80 backdrop-blur-md lg:flex">
      <div className="flex h-14 items-center gap-2 border-b-[0.5px] border-white/[0.06] px-5">
        <Logo />
        {scope === "admin" ? (
          <Badge tone="admin" className="ml-auto">
            Admin
          </Badge>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active =
              activePath === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                activePath.startsWith(item.href));
            const Icon = NAV_ICONS[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex h-9 items-center gap-3 rounded-sm px-3 text-sm transition-colors",
                    active
                      ? "bg-white/[0.05] text-foreground"
                      : "text-foreground-muted hover:bg-white/[0.02] hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-[2px] rounded-full transition-colors",
                      active
                        ? scope === "admin"
                          ? "bg-accent"
                          : "bg-acid"
                        : "bg-transparent",
                    )}
                  />
                  <Icon size={14} strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t-[0.5px] border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-3 rounded-sm px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm border-hairline border-white/10 bg-obsidian-800 font-mono text-xs text-foreground">
            {getInitials(user.fullName ?? user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {user.fullName ?? "Operator"}
            </p>
            <p className="truncate font-mono text-[10px] text-foreground-subtle">
              {user.email}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mt-2 w-full rounded-sm border-hairline border-white/[0.08] bg-transparent py-1.5 text-xs text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function Topbar({ scope, user }: { scope: "user" | "admin"; user: ShellUser }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b-[0.5px] border-white/[0.06] bg-obsidian-950/80 px-4 backdrop-blur-md lg:hidden">
      <Logo />
      <div className="flex items-center gap-2">
        {scope === "admin" ? <Badge tone="admin">Admin</Badge> : null}
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border-hairline border-white/10 bg-obsidian-800 font-mono text-[11px] text-foreground">
          {getInitials(user.fullName ?? user.email)}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level heading                                                         */
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
        {eyebrow ? <p className="text-eyebrow text-foreground-subtle">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex s