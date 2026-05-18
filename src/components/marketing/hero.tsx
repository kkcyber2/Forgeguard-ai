"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Terminal } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ease = [0.2, 0.7, 0.2, 1] as const;

const CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

export interface MarketingHeroProps {
  isAuthenticated: boolean;
  primaryCta: { href: string; label: string };
}

export function MarketingHero({ isAuthenticated, primaryCta }: MarketingHeroProps) {
  const reduce = useReducedMotion();

  return (
    <section className="relative isolate min-h-[92vh] w-full overflow-hidden pt-20 md:pt-24">
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.025]">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      <GridBackground variant="hero" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 pb-24 pt-14 md:grid-cols-12 md:px-8 md:pt-20 lg:gap-16 lg:pb-32">
        <motion.div
          variants={reduce ? undefined : CONTAINER}
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "show"}
          className="md:col-span-7 flex flex-col"
        >
          <motion.div variants={ITEM} className="mb-6">
            <Badge tone="live" dot className="h-6">
              Live · Red-team cluster online
            </Badge>
          </motion.div>

          <motion.h1
            variants={ITEM}
            className="text-display-xl text-foreground tracking-tightest text-balance"
          >
            Break your AI<br />
            before adversaries{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="text-acid">do</span>
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px bg-acid/60"
              />
            </span>
            .
          </motion.h1>

          <motion.p
            variants={ITEM}
            className="mt-6 max-w-xl text-lg text-foreground-muted text-pretty"
          >
            ForgeGuard fires 600+ adversarial probes against your production
            LLMs. Findings land in your CI pipeline within minutes, not quarters.
          </motion.p>

          <motion.div variants={ITEM} className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={primaryCta.href}
              className={buttonStyles({ variant: "primary", size: "lg" })}
            >
              {primaryCta.label}
              <ArrowUpRight size={16} strokeWidth={1.75} />
            </Link>
            <Link
              href={isAuthenticated ? "/dashboard/scans/new" : "/demo"}
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              <Terminal size={16} strokeWidth={1.5} />
              {isAuthenticated ? "Launch new scan" : "Live attack demo"}
            </Link>
          </motion.div>

          <motion.div
            variants={ITEM}
            className="mt-12 flex flex-wrap items-center gap-6 text-xs text-foreground-subtle"
          >
            {[
              { dot: "acid", label: "SOC 2 · Type II in progress" },
              { dot: "muted", label: "Self-host or Cloud" },
              { dot: "muted", label: "OWASP LLM Top 10 mapped" },
            ].map(({ dot, label }) => (
              <span key={label} className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    dot === "acid"
                      ? "bg-acid animate-pulse-acid"
                      : "bg-foreground-subtle",
                  )}
                />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? undefined : { opacity: 0, y: 24 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.3 }}
          className="md:col-span-5 relative"
        >
          <HeroHud />
        </motion.div>
      </div>
    </section>
  );
}

const PROBES: { tag: string; label: string; status: "blocked" | "breach" }[] = [
  { tag: "PROBE-0411", label: "System prompt extraction", status: "blocked" },
  { tag: "PROBE-0412", label: "Hidden instruction in tool output", status: "blocked" },
  { tag: "PROBE-0413", label: "Base64-encoded role override", status: "blocked" },
  { tag: "PROBE-0414", label: "Recursive role-swap escalation", status: "breach" },
  { tag: "PROBE-0415", label: "Exfil via markdown image", status: "blocked" },
  { tag: "PROBE-0416", label: "Multi-turn gaslighting chain", status: "blocked" },
  { tag: "PROBE-0417", label: "Invisible Unicode injection", status: "breach" },
  { tag: "PROBE-0418", label: "Indirect RAG poisoning", status: "blocked" },
];

function HeroHud() {
  const [visibleCount, setVisibleCount] = React.useState(4);
  const [scanCount, setScanCount] = React.useState(1284);

  React.useEffect(() => {
    const id = setInterval(() => {
      setVisibleCount((n) => (n >= PROBES.length ? 4 : n + 1));
      setScanCount((n) => n + Math.floor(Math.random() * 3) + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const visible = PROBES.slice(0, visibleCount);
  const breaches = visible.filter((p) => p.status === "breach").length;
  const blocked = visible.filter((p) => p.status === "blocked").length;

  return (
    <div className="relative">
      <div
        className={cn(
          "relative rounded-sm border-[0.5px] border-white/[0.08]",
          "bg-gradient-to-b from-obsidian-800/80 to-obsidian-900/80",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_40px_80px_-24px_rgba(0,0,0,0.9)]",
          "backdrop-blur-md overflow-hidden",
        )}
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-white/[0.06] px-4 h-9">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/10 border border-white/10" />
            <span className="h-2 w-2 rounded-full bg-white/10 border border-white/10" />
            <span className="h-2 w-2 rounded-full bg-acid/70 border border-acid/40 shadow-[0_0_6px_rgba(209,255,0,0.5)]" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-subtle">
            forgeguard / run-{scanCount.toString().slice(-4)}
          </span>
          <span className="font-mono text-[9px] text-acid animate-pulse-acid">● LIVE</span>
        </div>

        <div className="px-4 pt-4 space-y-2.5">
          <HudRow label="Target endpoint" value="api.acme-llm.com/v1/chat" />
          <HudRow label="Attack suite" value="injection · jailbreak · exfil" />
          <HudRow label="Probes fired" value={`${scanCount.toLocaleString()} / 1,500`} />
        </div>

        <div className="mx-4 my-3 h-px bg-white/[0.05]" />

        <div className="px-4 pb-2 space-y-1.5 min-h-[160px]">
          <AnimatePresence initial={false}>
            {visible.map((probe) => (
              <motion.div
                key={probe.tag}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <ProbeLine {...probe} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mx-4 mb-4 mt-3 grid grid-cols-3 gap-2 rounded-sm border-[0.5px] border-white/[0.05] bg-black/20 p-3">
          <HudMetric label="Blocked" value={String(blocked)} tone="secure" />
          <HudMetric label="Breaches" value={String(breaches)} tone="threat" />
          <HudMetric label="Uptime" value="99.98%" tone="neutral" />
        </div>
      </div>

      <div className="absolute -left-4 top-10 hidden lg:block">
        <div className="relative rounded-sm border-[0.5px] border-acid/40 bg-obsidian-900/90 px-3 py-2 text-[10px] font-mono text-acid shadow-[0_0_12px_rgba(209,255,0,0.15)]">
          guardrail.active
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-acid/5 blur-3xl"
      />
    </div>
  );
}

function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle shrink-0">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground truncate text-right">
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
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-foreground-subtle shrink-0">{tag}</span>
        <span className="truncate text-foreground/70">{label}</span>
      </div>
      {status === "blocked" ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-acid">
          <span className="h-1 w-1 rounded-full bg-acid" />
          blocked
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-threat">
          <span className="h-1 w-1 rounded-full bg-threat animate-pulse" />
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
    <div className="text-center">
      <div
        className={cn(
          "font-mono text-base font-bold leading-none",
          tone === "secure" ? "text-acid" : tone === "threat" ? "text-threat" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-foreground-subtle">
        {label}
      </div>
    </div>
  );
}
