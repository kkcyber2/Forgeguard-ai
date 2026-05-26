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
        "fixed left-0 top-14 z-30 hidden h-[calc(100vh-56px)] w-[220px] flex-col border-r border-white/[0.06] bg-[#050505] lg:flex",
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
              <p className="px-4 py-1 font-mono text-[8px] uppercase tracking-[0.28em] text-white/30">
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
          "flex items-center gap-2 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
          active
            ? "border-r-2 border-[#D1FF00] bg-[#D1FF00]/[0.06] text-[#D1FF00]"
            : "text-white/40 hover:bg-white/[0.03] hover:text-white/70",
        )}
      >
        <Icon size={11} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
