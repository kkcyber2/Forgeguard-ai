import * as React from "react";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { ArrowUpRight, CheckCircle2, Terminal, Globe, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Careers — ForgeGuard AI",
  description:
    "Join the team building adversarial AI security infrastructure. We operate like an offensive unit — fast, technical, no bureaucracy.",
};

const OPEN_ROLES = [
  {
    title: "Senior Adversarial ML Engineer",
    team: "Red Team Engine",
    type: "Full-time · Remote",
    description:
      "Design and ship novel prompt injection attack primitives. Own the attack-chain generator that runs inside our scan engine. Comfortable reading transformer internals and writing Python that does things models don't expect.",
    requirements: [
      "Deep familiarity with LLM internals (attention, embedding space, decoding)",
      "Shipped at least one novel jailbreak or injection method",
      "Python — not a framework user, a language user",
      "Comfortable with red-team tooling (Garak, PyRIT, custom toolchains)",
    ],
  },
  {
    title: "Full-Stack Security Engineer",
    team: "Platform",
    type: "Full-time · Remote",
    description:
      "Build the infrastructure that powers ForgeGuard. Next.js, Supabase, Railway, TypeScript — production-hardened, zero compromise on security. Own the proxy layer that keeps AI API keys off the client.",
    requirements: [
      "TypeScript — strict mode, no `any`",
      "Next.js App Router, Supabase RLS, Edge middleware",
      "Security mindset: you find XSS and IDOR in your own PRs before review",
      "Bonus: previous experience with sec tooling or bug bounty platforms",
    ],
  },
  {
    title: "Security Researcher — AI Red Teaming",
    team: "Bounty Program",
    type: "Contract · Remote",
    description:
      "Hunt vulnerabilities in AI systems deployed by ForgeGuard clients. You'll work through our bounty platform, submit reproducible exploits, and get paid per CVSS-scored finding. No ceiling on output.",
    requirements: [
      "Documented track record finding AI/LLM vulnerabilities",
      "Ability to write clear, reproducible PoCs",
      "Familiarity with MITRE ATLAS taxonomy",
      "Ethics: you disclose responsibly, always",
    ],
  },
  {
    title: "Infrastructure Engineer (Railway / Supabase)",
    team: "Platform",
    type: "Full-time · Remote",
    description:
      "Own the Railway-hosted Python backend that runs our scan orchestration. Optimize cold start times, build worker isolation, wire Supabase Realtime for live terminal streaming. Performance is a feature.",
    requirements: [
      "Python systems programming",
      "Railway or similar container platforms",
      "PostgreSQL — RLS policies, indexes, migrations",
      "Obsession with p99 latency and zero downtime deploys",
    ],
  },
];

const VALUES = [
  {
    icon: Terminal,
    title: "Ship, don't plan",
    body: "We deploy on Tuesdays. Not after 12 meetings. Real work ships. PRs are proof you exist.",
  },
  {
    icon: Zap,
    title: "Adversarial thinking",
    body: "We assume the attacker is smarter than us. Every system we build, we also try to break. Before anyone else does.",
  },
  {
    icon: Globe,
    title: "Fully remote, globally distributed",
    body: "Time zones are infrastructure. We do async first, sync for decisions only. Written communication is a skill we value.",
  },
];

export default async function CareersPage() {
  const user = await getSessionUser();
  const isAuthenticated = !!user;
  let destination = "/dashboard";
  if (isAuthenticated) {
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") destination = "/admin";
  }

  return (
    <main className="relative w-full">
      <MarketingNav session={{ isAuthenticated, destination }} />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-hairline bg-grid-lg opacity-[0.3]" />
        <div className="relative mx-auto max-w-4xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid mb-4">
            {"// careers"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Joining the{" "}
            <span className="text-acid">Marines</span>{" "}
            of AI.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground-muted">
            We don't do casual. We build infrastructure that catches adversarial
            attacks in production AI systems. The work is hard, the bar is high,
            and the impact is direct. If that's what you want — read on.
          </p>

          <div className="mt-8 inline-flex items-center gap-2 rounded-sm border border-acid/30 bg-acid/5 px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-acid animate-pulse" />
            <span className="font-mono text-[12px] text-acid">
              {OPEN_ROLES.length} positions open
            </span>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-white/[0.06] py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle mb-8">
            How we operate
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <v.icon size={18} strokeWidth={1.5} className="mb-4 text-acid/70" />
                <h3 className="mb-2 font-semibold text-foreground text-sm">{v.title}</h3>
                <p className="text-[13px] leading-relaxed text-foreground-muted">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-4xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle mb-2">
            Open positions
          </p>
          <h2 className="text-2xl font-bold text-foreground mb-12">
            Find your mission
          </h2>

          <div className="space-y-4">
            {OPEN_ROLES.map((role) => (
              <div
                key={role.title}
                className="group rounded-sm border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-acid/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{role.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-acid/70">
                        {role.team}
                      </span>
                      <span className="text-foreground-subtle">·</span>
                      <span className="text-[11px] text-foreground-muted">{role.type}</span>
                    </div>
                  </div>
                  <a
                    href={`mailto:careers@forgeguard.ai?subject=Application: ${encodeURIComponent(role.title)}`}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-acid/30 bg-acid/5 px-3 py-1.5 text-[11px] font-semibold text-acid transition-colors hover:bg-acid/15"
                  >
                    Apply
                    <ArrowUpRight size={11} />
                  </a>
                </div>

                <p className="mb-4 text-[13px] leading-relaxed text-foreground-muted">
                  {role.description}
                </p>

                <ul className="space-y-1.5">
                  {role.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[12px] text-foreground-muted">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-acid/60" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catch-all */}
      <section className="border-t border-white/[0.06] py-16">
        <div className="mx-auto max-w-2xl px-6 text-center md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle mb-4">
            Don't see your role?
          </p>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Send us a signal anyway.
          </h2>
          <p className="text-sm text-foreground-muted mb-6">
            If you do interesting offensive security work and think you belong
            here, we want to know. Send us a cold email with evidence of your
            work.
          </p>
          <a
            href="mailto:careers@forgeguard.ai"
            className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-5 py-2.5 text-sm text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
          >
            careers@forgeguard.ai
            <ArrowUpRight size={14} />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
