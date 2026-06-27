import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Globe, ShieldCheck, Trophy } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import {
  fetchOperatorProfile,
  fetchOperatorStats,
} from "@/lib/operators/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchOperatorProfile(id);
  if (!profile) return { title: "Operator not found" };
  const name = profile.full_name || "Anonymous operator";
  return {
    title: `${name} — Operator profile`,
    description: `ForgeGuard operator ${name}. Reputation ${profile.reputation ?? 0}.`,
    robots: { index: true, follow: true },
  };
}

export default async function OperatorProfilePage({ params }: Props) {
  const { id } = await params;
  const [profile, stats] = await Promise.all([
    fetchOperatorProfile(id),
    fetchOperatorStats(id),
  ]);
  if (!profile) notFound();

  const user = await getSessionUser();
  const isAuthenticated = !!user;
  let destination = "/dashboard";
  if (isAuthenticated) {
    const me = await getCurrentProfile();
    if (me?.role === "admin") destination = "/admin";
  }

  const name = profile.full_name?.trim() || "Anonymous operator";
  const rank = profile.hacker_rank?.trim();
  const reputation = profile.reputation ?? 0;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const stats2: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Reputation", value: reputation.toLocaleString(), icon: <Trophy size={14} className="text-acid" /> },
    { label: "CTF solves", value: String(stats.ctf_solves), icon: <ShieldCheck size={14} className="text-acid" /> },
    { label: "CTF points", value: stats.ctf_points.toLocaleString(), icon: <Trophy size={14} className="text-acid" /> },
    { label: "Bazaar scripts", value: String(stats.bazaar_scripts), icon: <BadgeCheck size={14} className="text-acid" /> },
    { label: "Bounties paid", value: String(stats.bounty_count), icon: <BadgeCheck size={14} className="text-acid" /> },
  ];

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-32 md:px-8">
        <Link
          href="/dashboard/intel"
          className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70"
        >
          <ArrowLeft size={13} />
          Leaderboard
        </Link>

        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-acid/25 bg-acid/[0.06]">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-mono text-2xl text-acid">{initials || "·"}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{name}</h1>
              {profile.identity_verified ? (
                <span className="inline-flex items-center gap-1 rounded border border-acid/30 bg-acid/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-acid">
                  <BadgeCheck size={11} /> Verified
                </span>
              ) : null}
            </div>
            {profile.job_title ? (
              <p className="mt-1 text-sm text-white/55">{profile.job_title}</p>
            ) : null}
            <p className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-white/40">
              {rank ? <span className="text-acid">{rank}</span> : null}
              {profile.clearance_tier ? <span>TIER · {profile.clearance_tier}</span> : null}
              {memberSince ? <span>Member since {memberSince}</span> : null}
            </p>
          </div>
        </header>

        {profile.company_tag && profile.domain_verified && profile.company_domain ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-white/60">
            <Globe size={12} className="text-acid" />
            {profile.company_tag} · {profile.company_domain}
          </p>
        ) : null}

        {profile.bio ? (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
            {profile.bio}
          </p>
        ) : (
          <p className="mt-6 text-sm italic text-white/35">
            This operator has not published a bio.
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats2.map((s) => (
            <div
              key={s.label}
              className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-white/40">
                {s.icon}
                {s.label}
              </p>
              <p className="text-xl font-semibold tabular-nums text-white">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/dashboard/ctf"
            className="rounded-sm border border-acid/30 bg-acid/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-acid"
          >
            Enter ForgeGrounds CTF
          </Link>
          <Link
            href="/dashboard/bazaar"
            className="rounded-sm border border-white/[0.08] bg-white/[0.02] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white/60"
          >
            Browse the Bazaar
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
