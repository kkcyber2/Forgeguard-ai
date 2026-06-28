import * as React from "react";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { Shield, Zap, Eye, Lock, Target, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About — ForgeGuard AI",
  description:
    "ForgeGuard AI was built to harden AI systems against adversarial attacks. We exist because every production LLM is a potential attack surface.",
};

const PILLARS = [
  {
    icon: Target,
    title: "Adversarial by Design",
    body: "We simulate real attackers. Not theoretical ones. Our red-team engine is trained on the MITRE ATLAS framework and updated continuously with zero-day prompt injection patterns harvested from live deployments.",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    body: "Every vulnerability we find gets a CVSS 4.0 score, a reproduction chain, and a remediation vector. No vague risk ratings. No marketing fluff. Just signal.",
  },
  {
    icon: Lock,
    title: "Security-First Architecture",
    body: "Our platform proxies all AI calls through a hardened Node.js layer. Your API keys never touch client code. Scan payloads and credentials are protected at rest (Supabase AES-256 disk encryption + Row-Level Security), sealed server-side, and isolated per tenant.",
  },
  {
    icon: Zap,
    title: "Sub-Second Detection",
    body: "Aegis, our runtime guardrail engine, intercepts malicious prompts at inference time — before they reach your model. Latency overhead: < 8 ms p99.",
  },
  {
    icon: Users,
    title: "Built by Operators",
    body: "Not academics. Our founding team shipped security tooling inside offensive cyber units. We know what gets exploited in production and we build accordingly.",
  },
  {
    icon: Shield,
    title: "Zero-Trust Default",
    body: "Every component — scans, webhooks, API calls — is authenticated, rate-limited, and audited. We apply the same adversarial standard to our own infrastructure.",
  },
];

const TIMELINE = [
  { year: "2023", label: "First prompt injection found in production GPT-4 deployment — we document the exploit chain" },
  { year: "Q1 2024", label: "ForgeGuard engine reaches private beta, scanning 10 LLM apps per week" },
  { year: "Q3 2024", label: "ATLAS-based attack taxonomy published; Aegis runtime guardrails reach v1.0" },
  { year: "Q4 2024", label: "Red-team bounty network launched — first 50 hackers deploy through the platform" },
  { year: "2025", label: "Stronghold 2.0 platform: multi-tenant, role-gated, CVSS 4.0-scored, production-hardened" },
];

export default async function AboutPage() {
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
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-obsidian-950 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid mb-4">
            {"// about_forgeguard.ai"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Every AI system is a{" "}
            <span className="text-acid">target.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground-muted">
            We built ForgeGuard because the industry shipped AI as if adversaries
            don't exist. They do. Our mission is to find every exploitable path in
            your AI stack before someone else does — and give you the tools to
            eliminate it permanently.
          </p>

          {/* Threat counter strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { value: "2,400+", label: "Threat signatures catalogued" },
              { value: "18 ms", label: "Avg detection latency" },
              { value: "97.4%", label: "True positive rate" },
              { value: "0", label: "Compromised deployments" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="font-mono text-2xl font-bold text-acid">{s.value}</p>
                <p className="mt-1 text-[11px] text-foreground-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-4xl px-6 md:px-8">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-foreground-subtle mb-4">
                The Problem
              </p>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                AI security is an afterthought.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-foreground-muted">
                <p>
                  The AI industry moves at a speed that makes traditional security
                  frameworks obsolete. New attack primitives — prompt injection,
                  jailbreaks, context poisoning, data exfiltration — emerge weekly.
                  Most organizations have no systematic way to track them.
                </p>
                <p>
                  Red teams are expensive and manual. Bug bounty programs for AI
                  are non-standard. Runtime monitoring doesn't understand the
                  semantic layer. The gap between deployment and hardening is
                  measured in months.
                </p>
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-foreground-subtle mb-4">
                Our Response
              </p>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Continuous, automated, systematic.
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-foreground-muted">
                <p>
                  ForgeGuard runs adversarial scans on a continuous loop, not a
                  quarterly schedule. Our DeepSeek-R1-powered engine generates
                  novel attack chains from first principles, not just pattern
                  matching against a known-bad list.
                </p>
                <p>
                  Results are CVSS 4.0-scored, reproducible, and tied directly to
                  remediation guidance. Aegis closes the loop at runtime, blocking
                  detected attack patterns before they reach inference.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle mb-2">
            Our principles
          </p>
          <h2 className="text-2xl font-bold text-foreground mb-12">
            How we operate
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="group rounded-sm border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-acid/20 hover:bg-acid/[0.02]"
              >
                <p.icon
                  size={18}
                  strokeWidth={1.5}
                  className="mb-4 text-acid/70 transition-colors group-hover:text-acid"
                />
                <h3 className="mb-2 font-semibold text-foreground text-sm">{p.title}</h3>
                <p className="text-[13px] leading-relaxed text-foreground-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-4xl px-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle mb-2">
            Field notes
          </p>
          <h2 className="text-2xl font-bold text-foreground mb-12">
            How we got here
          </h2>
          <div className="relative space-y-0">
            <div
              aria-hidden
              className="absolute left-[72px] top-2 bottom-2 w-px bg-white/[0.06] hidden md:block"
            />
            {TIMELINE.map((t) => (
              <div key={t.year} className="flex gap-6 py-5 border-b border-white/[0.04] last:border-0">
                <div className="shrink-0 w-[72px]">
                  <span className="font-mono text-[11px] text-acid">{t.year}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground-muted">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="mx-auto max-w-2xl px-6 text-center md:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Join the defense.
          </h2>
          <p className="text-sm text-foreground-muted mb-8">
            Whether you're hardening your own AI stack or hunting vulns for
            others — ForgeGuard is your platform.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-sm border border-acid/50 bg-acid/10 px-5 py-2.5 text-sm font-semibold text-acid transition-colors hover:bg-acid/20"
            >
              Deploy for free
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-5 py-2.5 text-sm text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
            >
              Talk to the team
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
