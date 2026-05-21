"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
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

/* ─── Holographic Monolith ──────────────────────────────────────────────── */

function GlareLayer({
  glareX,
  glareY,
}: {
  glareX: ReturnType<typeof useSpring>;
  glareY: ReturnType<typeof useSpring>;
}) {
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const unsub = glareX.on("change", () => {
      if (!divRef.current) return;
      const x = glareX.get();
      const y = glareY.get();
      divRef.current.style.background = `radial-gradient(
        320px 240px at ${x * 100}% ${y * 100}%,
        rgba(255,255,255,0.07) 0%,
        rgba(209,255,0,0.03) 30%,
        transparent 70%
      )`;
    });
    return unsub;
  }, [glareX, glareY]);

  return (
    <div
      ref={divRef}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

function ScanCounter() {
  const [count, setCount] = React.useState(14_847);
  React.useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3));
    }, 2800);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[11px] tabular-nums tracking-wider text-[#D1FF00]">
      {count.toLocaleString()}
    </span>
  );
}

function ThreatRing() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
      fill="none"
    >
      {/* Outer rotating ring */}
      <circle
        cx="100"
        cy="100"
        r="92"
        stroke="#D1FF00"
        strokeWidth="0.5"
        strokeDasharray="8 16"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 100 100"
          to="360 100 100"
          dur="28s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Inner counter-rotating ring */}
      <circle
        cx="100"
        cy="100"
        r="72"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.4"
        strokeDasharray="4 24"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 100 100"
          to="0 100 100"
          dur="18s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Corner tick marks */}
      {[0, 90, 180, 270].map((angle) => (
        <line
          key={angle}
          x1="100"
          y1="6"
          x2="100"
          y2="16"
          stroke="#D1FF00"
          strokeWidth="1"
          transform={`rotate(${angle} 100 100)`}
        />
      ))}
    </svg>
  );
}

function ActivityTicker() {
  const events = React.useMemo(
    () => [
      "CVE-2025-4471 scored CRITICAL",
      "Recon sweep completed — 3 hosts",
      "Bounty #88 submitted",
      "Forge session started",
      "Aegis rule deployed",
      "New mission posted",
    ],
    [],
  );
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % events.length), 3200);
    return () => clearInterval(id);
  }, [events]);

  return (
    <div className="h-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[10px] tracking-wider text-white/40"
        >
          {events[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function HolographicMonolith({ className }: { className?: string }) {
  const prefersReduced = useReducedMotion();

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const glareX = useSpring(rawX, { stiffness: 60, damping: 18 });
  const glareY = useSpring(rawY, { stiffness: 60, damping: 18 });

  React.useEffect(() => {
    if (prefersReduced) return;
    const handler = (e: MouseEvent) => {
      rawX.set(e.clientX / window.innerWidth);
      rawY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [rawX, rawY, prefersReduced]);

  return (
    <div className={cn("pointer-events-none select-none", className)} aria-hidden>
      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(209,255,0,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Threat ring SVG */}
      <ThreatRing />

      {/* The monolith — floating Y-axis breathing */}
      <motion.div
        className="absolute inset-8"
        animate={prefersReduced ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glass surface */}
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            border: "0.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px) saturate(140%)",
            WebkitBackdropFilter: "blur(20px) saturate(140%)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, rgba(0,0,0,0.08) 100%)",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.06), 0 24px 80px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Mouse-tracked glare */}
          <GlareLayer glareX={glareX} glareY={glareY} />

          {/* Scanlines overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
              backgroundSize: "100% 3px",
            }}
          />

          {/* Content panel */}
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#D1FF00] animate-pulse"
                  style={{ boxShadow: "0 0 6px rgba(209,255,0,0.8)" }}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#D1FF00]">
                  Live
                </span>
              </div>
              <span className="font-mono text-[9px] tracking-widest text-white/20">
                FORGEGUARD / CORE
              </span>
            </div>

            {/* Center — scan count */}
            <div className="flex flex-col items-center justify-center gap-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                Vulnerabilities Scored
              </p>
              <div className="flex items-baseline gap-1">
                <ScanCounter />
              </div>
            </div>

            {/* Footer — activity ticker */}
            <div className="flex flex-col gap-2">
              <div
                className="h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                }}
              />
              <ActivityTicker />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Hero Section ──────────────────────────────────────────────────────── */

export type MarketingHeroProps = {
  isAuthenticated: boolean;
  primaryCta: { href: string; label: string };
};

export function MarketingHero({ isAuthenticated, primaryCta }: MarketingHeroProps) {
  return <HeroSection isAuthenticated={isAuthenticated} primaryCta={primaryCta} />;
}

export function HeroSection({
  isAuthenticated = false,
  primaryCta = { href: "/auth/signup", label: "Deploy Now" },
}: {
  isAuthenticated?: boolean;
  primaryCta?: { href: string; label: string };
}) {
  return (
    <section className="relative isolate flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center overflow-hidden px-4 py-24 sm:py-32">
      {/* Background grid */}
      <GridBackground className="absolute inset-0 -z-10 opacity-40" />

      {/* Edge vignette */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 0%, transparent 40%, #050505 100%)",
        }}
      />

      {/* Holographic monolith — right side, below fixed nav (h-14) */}
      <div className="pointer-events-none absolute right-0 top-14 bottom-0 hidden w-[45%] lg:block z-[1]">
        <HolographicMonolith className="absolute inset-8 lg:inset-10" />
      </div>

      {/* Text column */}
      <motion.div
        className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-6 text-center lg:ml-0 lg:mr-auto lg:max-w-xl lg:items-start lg:text-left"
        variants={CONTAINER}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={ITEM}>
          <Badge variant="outline" className="gap-1.5 border-white/10 bg-white/[0.04] text-white/50">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#D1FF00]"
              style={{ boxShadow: "0 0 6px rgba(209,255,0,0.8)" }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              Stronghold 2.0
            </span>
          </Badge>
        </motion.div>

        <motion.h1
          variants={ITEM}
          className="font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl"
        >
          Offensive security.{" "}
          <span
            className="text-transparent"
            style={{
              WebkitTextStroke: "1px rgba(209,255,0,0.7)",
            }}
          >
            Surgical precision.
          </span>
        </motion.h1>

        <motion.p
          variants={ITEM}
          className="max-w-lg text-base leading-relaxed text-white/40"
        >
          AI-powered red teaming, vulnerability scoring, and adversarial
          automation — built for operators who move faster than threats.
        </motion.p>

        <motion.div variants={ITEM} className="flex flex-wrap items-center gap-3">
          <Link
            href={primaryCta.href}
            className={buttonStyles({
              size: "md",
              className:
                "bg-[#D1FF00] font-mono text-[11px] uppercase tracking-widest text-black hover:bg-[#D1FF00]/90",
            })}
          >
            {primaryCta.label}
            <ArrowUpRight size={14} className="ml-1" />
          </Link>
          {!isAuthenticated && (
            <Link
              href="/auth/login"
              className={buttonStyles({
                variant: "ghost",
                size: "md",
                className:
                  "border-[0.5px] border-white/10 font-mono text-[11px] uppercase tracking-widest text-white/50 hover:border-white/20 hover:text-white/80",
              })}
            >
              <Terminal size={12} className="mr-1.5" />
              Access Terminal
            </Link>
          )}
        </motion.div>

        {/* Stat row */}
        <motion.div
          variants={ITEM}
          className="flex items-center gap-6 pt-2"
        >
          {[
            { label: "CVEs Scored", value: "14.8k+" },
            { label: "Active Ops", value: "342" },
            { label: "Uptime", value: "99.97%" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="font-mono text-base font-semibold tabular-nums text-white">
                {value}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Mobile monolith */}
      <motion.div
        variants={ITEM}
        initial="hidden"
        animate="show"
        className="relative mt-16 h-56 w-full max-w-sm lg:hidden"
      >
        <HolographicMonolith className="absolute inset-0" />
      </motion.div>
    </section>
  );
}
