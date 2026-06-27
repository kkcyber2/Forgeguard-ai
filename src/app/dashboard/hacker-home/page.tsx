import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Crosshair,
  Store,
  Target,
  Globe,
  Trophy,
  ShieldCheck,
  Coins,
  Briefcase,
} from "lucide-react";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchDashboardOverview } from "@/lib/dashboard/fetch-overview";
import { fetchPublishedChallenges, fetchUserSolves } from "@/lib/ctf/queries";
import { normalizeHackerRankLabel } from "@/lib/access/ranks";

export const dynamic = "force-dynamic";

export default async function HackerHomePage() {
  const user = await getSessionUser();
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();

  const [overview, challenges, solves] = await Promise.all([
    fetchDashboardOverview(supabase, user!.id),
    fetchPublishedChallenges(),
    fetchUserSolves(),
  ]);

  const reputation = overview.reputation ?? profile?.reputation ?? 0;
  const rank = normalizeHackerRankLabel(profile?.hacker_rank);
  const ctfSolved = solves.size;
  const ctfTotal = challenges.length;
  const ctfPoints = challenges
    .filter((c) => solves.has(c.id))
    .reduce((s, c) => s + c.points, 0);

  const kpis: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Reputation", value: reputation.toLocaleString(), icon: <Trophy size={14} className="text-acid" /> },
    { label: "Active missions", value: String(overview.activeMissionCount), icon: <Briefcase size={14} className="text-acid" /> },
    { label: "Bazaar sales · 7d", value: String(overview.recentBazaarSales), icon: <Store size={14} className="text-acid" /> },
    { label: "Bounty escrow held", value: `$${overview.activeBountySpend.toLocaleString()}`, icon: <Coins size={14} className="text-acid" /> },
    { label: "Aegis rules", value: String(overview.aegisRuleCount), icon: <ShieldCheck size={14} className="text-acid" /> },
    { label: "CTF points", value: ctfPoints.toLocaleString(), icon: <Target size={14} className="text-acid" /> },
  ];

  const actions: { href: string; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      href: "/dashboard/ctf",
      label: "ForgeGrounds CTF",
      desc: "Capture flags on LLM red-team labs to bank reputation.",
      icon: <Crosshair size={16} className="text-acid" />,
    },
    {
      href: "/dashboard/bazaar",
      label: "The Bazaar",
      desc: "Publish and sell attack/defense scripts to other operators.",
      icon: <Store size={16} className="text-acid" />,
    },
    {
      href: "/dashboard/bounties",
      label: "Kinetic Bounties",
      desc: "Fund or claim bounties tied to real ALE reduction.",
      icon: <Coins size={16} className="text-acid" />,
    },
    {
      href: "/dashboard/intel",
      label: "Intel Hub",
      desc: "OSINT, threat almanac, and the operator leaderboard.",
      icon: <Globe size={16} className="text-acid" />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
          Hacker Home
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-white/45">
          {rank ? <span className="text-acid">{rank}</span> : null}
          {profile?.clearance_tier ? <span>TIER · {profile.clearance_tier}</span> : null}
          <span>{reputation.toLocaleString()} REP</span>
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-4"
          >
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-white/40">
              {k.icon}
              {k.label}
            </p>
            <p className="text-xl font-semibold tabular-nums text-white">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-10 rounded-sm border border-acid/20 bg-acid/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
              ForgeGrounds progress
            </p>
            <p className="mt-1 text-sm text-white/70">
              {ctfSolved} / {ctfTotal} challenges cleared ·{" "}
              <span className="text-acid">{ctfPoints.toLocaleString()} pts</span> banked
            </p>
          </div>
          <Link
            href="/dashboard/ctf"
            className="inline-flex items-center gap-2 rounded-sm border border-acid/30 bg-acid/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-acid"
          >
            Continue <ArrowRight size={13} />
          </Link>
        </div>
        {ctfTotal > 0 ? (
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-acid/70"
              style={{ width: `${Math.round((ctfSolved / ctfTotal) * 100)}%` }}
            />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          Operator surfaces
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {actions.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="group flex items-start gap-4 rounded-sm border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-acid/25"
              >
                <span className="mt-0.5 shrink-0">{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    {a.label}
                    <ArrowRight
                      size={13}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-white/50">
                    {a.desc}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
