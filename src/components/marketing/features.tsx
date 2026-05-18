"use client";

import * as React from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import {
  Crosshair,
  ShieldCheck,
  Activity,
  Terminal,
  Layers,
  Radar,
} from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { cn } from "@/lib/utils";

/**
 * Feature grid — "Linear.app meets SentinelOne" aesthetic.
 * ──────────────────────────────────────────────────────────
 * • Framer Motion stagger: each card enters as a child of the
 *   motion container. useInView triggers once the section scrolls
 *   into the viewport — no instant fire on load.
 * • Sharp 4px radius, 0.5px borders, acid glow on hover.
 * • Icon box transitions from steel to acid on hover.
 * • A hairline acid accent appears at the top of each card on hover.
 */

const ease = [0.2, 0.7, 0.2, 1] as const;

const CONTAINER = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const CARD = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
};

const FEATURES = [
  {
    icon: Crosshair,
    title: "Continuous red-teaming",
    body:
      "600+ adversarial probes — prompt injection, jailbreak, data exfil, tool abuse — fired on every deploy, not once a quarter.",
  },
  {
    icon: ShieldCheck,
    title: "Runtime guardrails",
    body:
      "Deterministic and model-based policies evaluated in < 80 ms. Drop the SDK in front of your provider; no router rewrites.",
  },
  {
    icon: Radar,
    title: "Behavioral telemetry",
    body:
      "Every request is diffed against a learned baseline. Anomalies surface in the command-center in near real-time.",
  },
  {
    icon: Activity,
    title: "MITRE ATLAS coverage",
    body:
      "Probes mapped to ATLAS tactics — you see exactly which adversarial ML techniques your stack actually resists.",
  },
  {
    icon: Terminal,
    title: "Agent-aware testing",
    body:
      "First-class support for tool-calling agents: sandboxed exec, multi-hop chains, model-hopping — we test the full graph.",
  },
  {
    icon: Layers,
    title: "Policy as code",
    body:
      "Guardrails live in your repo as versioned YAML. Your security team reviews them in the same PR your engineers ship.",
  },
] as const;

export function FeatureGrid() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });

  return (
    <Section id="platform" className="border-t-[0.5px] border-white/[0.04]">
      {/* Heading — simple fade-in */}
      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease }}
      >
        <SectionHeading
          eyebrow="Platform"
          title={
            <>
              The offensive + defensive loop,
              <br className="hidden md:block" /> in one control plane.
            </>
          }
          lede="Most teams bolt on a red-team consultancy once a year and hope for the best. ForgeGuard runs the attacks continuously and wires the findings straight into the policy engine guarding production."
        />
      </motion.div>

      {/* Staggered grid */}
      <motion.div
        ref={ref}
        variants={reduce ? undefined : CONTAINER}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? (inView ? "show" : "hidden") : inView ? "show" : "hidden"}
        className="mt-14 grid grid-cols-1 gap-px bg-white/[0.04] rounded-sm overflow-hidden border-[0.5px] border-white/[0.06] md:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <FeatureCard key={title} icon={Icon} title={title} body={body} />
        ))}
      </motion.div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Single feature card                                                        */
/* -------------------------------------------------------------------------- */

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  body: string;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.div
      variants={CARD}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative bg-surface p-7 transition-colors duration-200",
        "hover:bg-obsidian-800",
      )}
    >
      {/* Acid hairline accent at card top — appears on hover */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{ originX: 0 }}
        className="absolute inset-x-0 top-0 h-px bg-acid/70"
      />

      <div className="flex items-center gap-3">
        {/* Icon box */}
        <motion.div
          animate={{
            borderColor: hovered ? "rgba(209,255,0,0.35)" : "rgba(255,255,255,0.08)",
            backgroundColor: hovered ? "rgba(209,255,0,0.06)" : "rgba(255,255,255,0.03)",
            boxShadow: hovered
              ? "0 0 12px rgba(209,255,0,0.12)"
              : "none",
          }}
          transition={{ duration: 0.22 }}
          className="flex h-8 w-8 items-center justify-center rounded-sm border"
        >
          <Icon
            size={14}
            strokeWidth={1.5}
            className={cn(
              "transition-colors duration-200",
              hovered ? "text-acid" : "text-foreground-muted",
            )}
          />
        </motion.div>

        <h3 className="text-base font-medium tracking-tight text-foreground">
          {title}
        </h3>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
        {body}
      </p>
    </motion.div>
  );
}
