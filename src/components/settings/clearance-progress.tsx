"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Circle,
  FileSearch,
  Globe,
  PenLine,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ClearanceTier = "pending" | "tactical" | "professional" | "sovereign";

export interface ClearanceProgressProps {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasSignature: boolean;
  domainVerified: boolean;
  identityDocUploaded: boolean;
  identityVerified: boolean;
  clearanceTier: ClearanceTier;
  auditScore: number | null;
  sovereignPending: boolean;
}

const TIERS: {
  id: ClearanceTier;
  label: string;
  color: string;
  minSteps: number;
}[] = [
  { id: "pending", label: "Pending review", color: "#A78BFA", minSteps: 0 },
  { id: "tactical", label: "Tactical", color: "#F59E0B", minSteps: 2 },
  { id: "professional", label: "Professional", color: "#38BDF8", minSteps: 4 },
  { id: "sovereign", label: "Sovereign", color: "#D1FF00", minSteps: 6 },
];

export function ClearanceProgress(props: ClearanceProgressProps) {
  const steps = [
    {
      id: "email",
      icon: BadgeCheck,
      label: "Email confirmed",
      done: props.emailVerified,
      href: undefined,
    },
    {
      id: "phone",
      icon: Phone,
      label: "Phone verified",
      done: props.phoneVerified,
      href: "#clearance-phone",
    },
    {
      id: "signature",
      icon: PenLine,
      label: "Digital seal",
      done: props.hasSignature,
      href: "#signature",
    },
    {
      id: "domain",
      icon: Globe,
      label: "Corporate domain",
      done: props.domainVerified,
      href: "#domain",
    },
    {
      id: "document",
      icon: FileSearch,
      label: "Identity documentation",
      done: props.identityDocUploaded,
      href: "#clearance-audit",
    },
    {
      id: "sovereign",
      icon: Camera,
      label: "Sovereign clearance",
      done: props.clearanceTier === "sovereign" && props.identityVerified,
      href: "#clearance-audit",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);
  const activeTier =
    TIERS.find((t) => t.id === props.clearanceTier) ??
    (completed >= 5 ? TIERS[2] : completed >= 3 ? TIERS[1] : TIERS[0]);

  return (
    <div className="rounded-[4px] border-[0.5px] border-white/[0.08] bg-[#050505]/80 p-5 space-y-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck size={12} className="text-[#D1FF00]/70" />
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
          Clearance Progress
        </p>
        <span
          className="ml-auto rounded-[3px] border-[0.5px] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
          style={{
            color: activeTier.color,
            borderColor: `${activeTier.color}40`,
            background: `${activeTier.color}10`,
          }}
        >
          {activeTier.label}
        </span>
      </div>

      {/* Tier ladder */}
      <div className="grid grid-cols-3 gap-1">
        {TIERS.map((tier) => {
          const active = props.clearanceTier === tier.id;
          const unlocked =
            tier.id === "tactical" ||
            (tier.id === "professional" &&
              (props.phoneVerified || props.hasSignature)) ||
            (tier.id === "sovereign" && props.identityVerified);
          return (
            <div
              key={tier.id}
              className={cn(
                "rounded-[3px] border-[0.5px] px-2 py-2 text-center transition-colors",
                active
                  ? "border-[#D1FF00]/30 bg-[#D1FF00]/[0.06]"
                  : unlocked
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/[0.05] bg-transparent opacity-40",
              )}
            >
              <p
                className="font-mono text-[8px] uppercase tracking-[0.18em]"
                style={{ color: active ? tier.color : "rgba(255,255,255,0.35)" }}
              >
                {tier.label}
              </p>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between font-mono text-[10px] text-zinc-400">
          <span>
            {completed}/{steps.length} vectors sealed
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full bg-[#D1FF00]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.id}>
              <a
                href={step.href}
                className={cn(
                  "flex items-center gap-2 rounded-[3px] px-2 py-1.5",
                  step.href && !step.done && "hover:bg-white/[0.03]",
                )}
              >
                {step.done ? (
                  <CheckCircle2 size={12} className="text-[#D1FF00]" />
                ) : (
                  <Circle size={12} className="text-zinc-600" />
                )}
                <Icon size={10} className="text-zinc-500" />
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    step.done ? "text-zinc-300" : "text-zinc-500",
                  )}
                >
                  {step.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {props.auditScore != null && (
        <p className="font-mono text-[10px] text-zinc-400">
          AI audit score:{" "}
          <span className="text-[#D1FF00] tabular-nums">{props.auditScore.toFixed(1)}</span>
          /100
        </p>
      )}

      {props.sovereignPending && props.clearanceTier !== "sovereign" && (
        <p className="rounded-[3px] border-[0.5px] border-amber-400/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[10px] text-amber-300/90">
          Sovereign clearance pending admin review.
        </p>
      )}
    </div>
  );
}
