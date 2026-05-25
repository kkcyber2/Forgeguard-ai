"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { type NavItem, type ShellUser, NAV_ICONS } from "@/components/dashboard/shell";
import { IdentitySwitcher } from "@/components/dashboard/identity-switcher";
import type { SovereignRole, ViewMode } from "@/lib/access/parallel-sovereignty";

/**
 * MobileNav — Command Burger menu for viewports < 768px (md).
 */
export function MobileNav({
  nav,
  user,
  scope,
  activePath,
  viewMode = "hacker",
  sovereignRole,
  identityChosen = true,
  canSwitchIdentity = false,
}: {
  nav: NavItem[];
  user: ShellUser;
  scope: "user" | "admin";
  activePath: string;
  viewMode?: ViewMode;
  sovereignRole?: SovereignRole;
  identityChosen?: boolean;
  canSwitchIdentity?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setOpen(false);
  }, [activePath]);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const closeBtn = drawerRef.current?.querySelector<HTMLElement>(
      'button[aria-label="Close command menu"]',
    );
    closeBtn?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] bg-obsidian-800/60 text-foreground-muted transition-colors hover:text-foreground"
      >
        <Menu size={15} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal={open}
        aria-label="Command navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r-[0.5px] border-white/[0.06] bg-obsidian-950 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b-[0.5px] border-white/[0.06] px-5">
          <div>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="font-mono text-sm font-bold tracking-widest text-foreground hover:text-acid transition-colors"
            >
              FORGEGUARD
            </Link>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-subtle">
              Command OS
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command menu"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground-subtle hover:text-foreground"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {canSwitchIdentity && (
          <div className="border-b-[0.5px] border-white/[0.06] px-5 py-3">
            <IdentitySwitcher
              activeMode={sovereignRole ?? viewMode}
              canSwitch={canSwitchIdentity}
              operatorEmail={user.email}
              compact
            />
          </div>
        )}

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
