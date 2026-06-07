"use client";

import * as React from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { ScanSearch, FileCheck2, ShieldCheck } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { cn } from "@/lib/utils";

/**
 * Feature grid — enterprise compliance pillars for the public landing page.
 * Three focused capabilities: data-leak auditing, regulatory reporting,
 * and runtime prompt shields.
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
    icon: ScanSearch,
    title: "Data-Leak Auditing",
    body:
      "Automatic detection of PII exposure across prompts, completions, and tool outputs. Sensitive patterns — SSNs, account numbers, credentials — are flagged, scored, and routed to remediation before they leave your perimeter.",
  },
  {
    icon: FileCheck2,
    title: "ISO/GDPR Compliance Reporting",
    body:
      "Board-ready executive summaries in Sections A–D: scope and data inventory, control posture, incident findings, and remediation roadmap. Exportable artifacts aligned with ISO 27001 and GDPR Article 30 record-keeping.",
  },
  {
    icon: ShieldCheck,
    title: "Aegis Prompt Shields",
    body:
      "Instant immunity code generation from audit findings. Drop-in middleware, SDK snippets, and policy-as-code rules that enforce data-integrity controls at inference time.",
  },
] as const;

export function FeatureGrid() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });

  return (
    <Section id="platform" className="border-t-[0.5px] border-white/[0.04]">
      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease }}
      >
        <SectionHeading
          eyebrow="Platform"
          title={
            <>
              Enterprise data protection,
              <br className="hidden md:block" /> from audit to enforcement.
            </>
          }
          lede="ForgeGuard unifies continuous compliance auditing, regulatory reporting, and runtime guardrails in one control plane — so security, legal, and engineering share a single source of truth."
        />
      </motion.div>

      <motion.div
        ref={ref}
        variants={reduce ? undefined : CONTAINER}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? (inView ? "show" : "hidden") : inView ? "show" : "hidden"}
        className="mt-14 grid grid-cols-1 gap-px bg-white/[0.04] rounded-sm overflow-hidden border-[0.5px] border-white/[0.06] md:grid-cols-3"
      >
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <FeatureCard key={title} icon={Icon} title={title} body={body} />
        ))}
      </motion.div>
    </Section>
  );
}

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
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{ originX: 0 }}
        className="absolute inset-x-0 top-0 h-px bg-acid/70"
      />

      <div className="flex items-center gap-3">
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
