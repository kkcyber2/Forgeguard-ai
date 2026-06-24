"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type NavItem, NAV_ICONS } from "@/components/dashboard/shell";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { buildSovereignMasterNav } from "@/lib/access/parallel-sovereignty";

const SECTION_ORDER = ["SYSTEM", "HACKER", "CLIENT", "OPS"] as const;

export function SovereignMasterSidebar({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const { sections } = buildSovereignMasterNav();

  if (!isSovereignOperator(email)) return null;

  return (
    <aside
      className={cn(
        "fg-sidebar fixed left-0 top-14 z-30 hidden h-[calc(100vh-56px)] w-[220px] flex-col border-r border-border bg-background lg:flex",
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto py-3">
        {SECTION_ORDER.map((sectionKey) => {
          const items = sections[sectionKey];
          if (!items?.length) return null;
          const seen = new Set<string>();
          const unique = items.filter((item) => {
            const key = `${item.href}:${item.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return (
            <div key={sectionKey} className="mb-4">
              <p className="fg-sidebar-section px-4 py-1 font-mono text-[8px] uppercase tracking-[0.28em] text-foreground-subtle">
                {sectionKey}
              </p>
              <ul className="space-y-0.5">
                {unique.map((item) => (
                  <SidebarLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
  const Icon = NAV_ICONS[item.icon];

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "fg-sidebar-link flex items-center gap-2 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
          active
            ? "border-r-2 border-[#D1FF00] bg-[#D1FF00]/[0.06] text-[#D1FF00]"
            : "text-foreground-subtle hover:bg-foreground/5 hover:text-foreground-muted",
        )}
      >
        <Icon size={11} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
