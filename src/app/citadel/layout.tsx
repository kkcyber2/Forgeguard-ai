import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureAgencyBootstrap,
  requireCitadelAccess,
} from "@/lib/citadel/access";

export const metadata: Metadata = {
  title: "Citadel — Compartment Zero",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/citadel", label: "Fusion" },
  { href: "/citadel/leads", label: "Leads" },
  { href: "/citadel/watchlists", label: "Watchlists" },
  { href: "/citadel/roster", label: "Roster" },
] as const;

export default async function CitadelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCitadelAccess();
  await ensureAgencyBootstrap(user.userId, user.email);

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100">
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/80">
              Citadel
            </p>
            <h1 className="text-sm font-medium text-zinc-200">Compartment Zero</h1>
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-cyan-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">
            {user.member.role}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
