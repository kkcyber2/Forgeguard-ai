"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Mail,
  Phone,
  Globe,
  PenLine,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationStep {
  id: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  detail: string;
  done: boolean;
  href?: string; // anchor to scroll to
}

interface Props {
  emailVerified: boolean;
  hasPhone: boolean;
  domainVerified: boolean;
  hasSignature: boolean;
  identityProofed: boolean;
}

export function VerificationProgress({
  emailVerified,
  hasPhone,
  domainVerified,
  hasSignature,
  identityProofed,
}: Props) {
  const steps: VerificationStep[] = [
    {
      id: "email",
      icon: Mail,
      label: "Email confirmed",
      detail: "Access to your inbox verified",
      done: emailVerified,
    },
    {
      id: "phone",
      icon: Phone,
      label: "Phone number",
      detail: "Added in Profile section",
      done: hasPhone,
      href: "#profile",
    },
    {
      id: "domain",
      icon: Globe,
      label: "Corporate domain",
      detail: "DNS TXT record verified",
      done: domainVerified,
      href: "#domain",
    },
    {
      id: "signature",
      icon: PenLine,
      label: "Digital signature",
      detail: "Legal armor for missions",
      done: hasSignature,
      href: "#signature",
    },
    {
      id: "identity",
      icon: Camera,
      label: "Identity proofing",
      detail: "Webcam confirmation",
      done: identityProofed,
      href: "#identity",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  const tier =
    completed === total
      ? { label: "Sovereign", color: "#D1FF00" }
      : completed >= 3
        ? { label: "Operator", color: "#38BDF8" }
        : completed >= 1
          ? { label: "Recruit", color: "#F59E0B" }
          : { label: "Unverified", color: "#6B7280" };

  return (
    <div className="rounded-sm border border-white/[0.06] bg-surface p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">Verification status</p>
        <span
          className="ml-auto rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
          style={{
            color: tier.color,
            background: `${tier.color}14`,
            border: `0.5px solid ${tier.color}40`,
          }}
        >
          {tier.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-foreground-subtle">
            {completed} / {total} complete
          </span>
          <span className="font-mono text-[10px] text-foreground-subtle">{pct}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: tier.color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            <a
              href={step.href ? step.href : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 transition-colors",
                step.href && !step.done
                  ? "cursor-pointer hover:bg-white/[0.03]"
                  : "cursor-default",
              )}
            >
              {step.done ? (
                <CheckCircle2 size={13} strokeWidth={1.75} className="shrink-0 text-acid" />
              ) : (
                <Circle size={13} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    step.done ? "text-zinc-300" : "text-zinc-500",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600 leading-none">{step.detail}</p>
              </div>
              {!step.done && step.href && (
                <span className="shrink-0 font-mono text-[9px] text-zinc-600 hover:text-zinc-400">
                  Set up →
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      {completed === total && (
        <div className="flex items-center gap-2 rounded-[4px] border border-acid/20 bg-acid/[0.06] px-3 py-2">
          <ShieldCheck size={11} className="shrink-0 text-acid" />
          <p className="text-[10px] text-acid">Sovereign identity fully established.</p>
        </div>
      )}
    </div>
  );
}
