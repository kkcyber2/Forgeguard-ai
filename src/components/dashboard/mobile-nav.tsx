"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { type NavItem, type ShellUser, NAV_ICONS } from "@/components/dashboard/shell";
import { IdentitySwitcher } from "@/components/dashboard/identity-switcher";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

/**
 * MobileNav — hamburger sheet for sub-lg viewports.
 * Opens a slide-in drawer over the content area.
 * Uses local React state so no shadcn Sheet dep needed.
 */
export function MobileNav({
  nav,
  user,
  scope,
  activePath,
  viewMode = "hacker",
  identityChosen = true,
}: {
  nav: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  activePath: string;
  viewMode?: ViewMode;
  identityChosen?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  // Close on route change
  React.useEffect(() => {
    setOpen(false);
  }, [activePath]);

  // Lock body scroll when open
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] bg-obsidian-800/60 text-foreground-muted transition-colors hover:text-foreground"
      >
        <Menu size={15} strokeWidth={1.75} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r-[0.5px] border-white/[0.06] bg-obsidian-950 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b-[0.5px] border-white/[0.06] px-5">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="font-mono text-sm font-bold tracking-widest text-foreground hover:text-acid transition-colors"
          >
            FORGEGUARD
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground-subtle hover:text-foreground"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {scope === "user" && (
          <div className="border-b-[0.5px] border-white/[0.06] px-5 py-3">
            <IdentitySwitcher activeMode={viewMode} canSwitch={identityChosen} compact />
          </div>
        )}

        {/* Nav links */}
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
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors",
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

        {/* User footer */}
        <div className="border-t-[0.5px] border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-3 rounded-sm px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-hairline border-white/10 bg-obsidian-800 font-mono text-xs text-foreground">
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
      </div>
    </>
  );
}
