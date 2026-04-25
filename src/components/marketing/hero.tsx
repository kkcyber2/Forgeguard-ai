"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Terminal } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Landing hero.
 * Staggered entrance, hairline live-status badge, monochrome display
 * type with a single acid accent word. A small HUD panel on the right
 * sells the product category without any 3D spinning crystal.
 *
 * The "Deploy" CTA resolves at request time — authenticated users go
 * straight to /dashboard/scans/new, guests go to /auth/signup.
 */

const ease = [0.2, 0.7, 0.2, 1] as const;

export interface MarketingHeroProps {
  isAuthenticated: boolean;
  primaryCta: { href: string; label: string };
}

export function MarketingHero({ isAuthenticated, primaryCta }: MarketingHeroProps) {
  const reduce = useReducedMotion();
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
  };

  return (
    <section className="relative isolate min-h-[92vh] w-full overflow-hidden pt-20 md:pt-24">
      <GridBackground variant="hero" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 pb-24 pt-14 md:grid-cols-12 md:px-8 md:pt-20 lg:gap-16 lg:pb-32">
        <motion.div
          variants={reduce ? undefined : container}
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "show"}
          className="md:col-span-7 flex flex-col"
        >
          <motion.div variants={item} className="mb-6">
            <Badge tone="live" dot className="h-6">
              Live · Red-team cluster online
            </Badge>
          </motion.div>

          <motion.h1
            variants={item}
            className="text-display-xl text-foreground tracking-tightest text-balance"
          >
            Adversarial defense<br />
            for production{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="text-acid">LLMs</span>
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px bg-acid/60"
              />
            </span>
            .
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg text-foreground-muted text-pretty"
          >
            ForgeGuard simulates prompt-injection, jailbreak and
            data-exfiltration attacks against your agents — then hardens
            the failures with runtime guardrails, continuously.
          </motion.p>

          <motion.div variants={item} className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={primaryCta.href}
              className={buttonStyles({ variant: "primary", size: "lg" })}
            >
              {primaryCta.label}
              <ArrowUpRight size={16} strokeWidth={1.75} />
            </Link>
            <Link
              href={isAuthenticated ? "/dashboard" : "/demo"}
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              <Terminal size={16} strokeWidth={1.5} />
              {isAuthenticated ? "Open command center" : "Live attack demo"}
            </Link>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-12 flex items-center gap-6 text-xs text-foreground-subtle"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-acid animate-pulse-acid" />
              SOC 2 · Type II in progress
            </span>
            <span className="hidden sm:inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-foreground-subtle" />
              Self-host or Cloud
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? undefined : { opacity: 0, y: 20 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.25 }}
          className="md:col-span-5 relative"
        >
          <HeroHud />
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* HUD                                                                        */
/* -------------------------------------------------------------------------- */

function HeroHud() {
  return (
    <div className="relative">
      {/* Outer glass frame */}
      <div
        className={cn(
          "relative rounded-sm border-hairline border-white/[0.08]",
          "bg-gradient-to-b from-obsidian-800/80 to-obsidian-900/80",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_32px_64px_-32px_rgba(0,0,0,0.8)]",
          "backdrop-blur-md overflow-hidden",
        )}
      >
        {/* Top chrome */}
        <div className="flex items-center justify-between border-b-[0.5px] border-white/[0.06] px-4 h-9">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-acid animate-pulse-acid" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-subtle">
            forgeguard / run-882f
          </span>
        </div>

        {/* Body */}
        <div className="relative px-4 py-5 space-y-4">
          <HudRow
            label="Target endpoint"
            value="api.acme-llm.com/v1/chat"
            tone="neutral"
          />
          <HudRow
            label="Attack suite"
            value="injection · jailbreak · exfil"
            tone="neutral"
          />
          <HudRow label="Probes fired" value="1,284 / 1,500" tone="neutral" />

          <div className="my-2 divider-x" />

          <ProbeLine
            tag="PROBE-0412"
            label="Hidden instruction in tool output"
            status="blocked"
          />
          <ProbeLine
            tag="PROBE-0413"
            label="Base64-encoded system override"
            status="blocked"
          />
          <ProbeLine
            tag="PROBE-0414"
            label="Recursive role-swap escalation"
            status="breach"
          />
          <ProbeLine
            tag="PROBE-0415"
            label="Exfil via markdown image"
            status="blocked"
          />

          <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t-[0.5px] border-white/[0.05]">
            <HudMetric label="Blocked" value="1,247" tone="secure" />
            <HudMetric label="Breaches" value="3" tone="threat" />
            <HudMetric label="Uptime" value="99.98%" tone="neutral" />
          </div>
        </div>
      </div>

      {/* Floating glow — not a 3D ball; just a hairline badge */}
      <div className="absolute -left-4 top-10 hidden lg:block">
        <div className="relative rounded-sm border-hairline border-acid/40 bg-obsidian-900/90 px-3 py-2 text-[10px] font-mono text-acid shadow-glow-acid">
          guardrail.active
        </div>
      </div>
    </div>
  );
}

function HudRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "secure";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-xs text-right",
          tone === "secure" ? "text-acid" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ProbeLine({
  tag,
  label,
  status,
}: {
  tag: string;
  label: string;
  status: "blocked" | "breach";
}) {
  return (
    <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-foreground-subtle">{tag}</span>
        <span className="truncate text-foreground/80">{label}</span>
      </div>
      {status === "blocked" ? (
        <span className="inline-flex items-center gap-1 text-acid">
          <span className="h-1 w-1 rounded-full bg-acid" />
          blocked
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-threat">
          <span className="h-1 w-1 rounded-full bg-threat animate-pulse-threat" />
          breach
        </span>
      )}
    </div>
  );
}

function HudMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "secure" | "threat" | "neutral";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg mt-0.5",
          tone === "secure"
            ? "text-acid"
            : tone === "threat"
            ? "text-threat"
            : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
