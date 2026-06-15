"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  FileSearch,
  Globe,
  Mail,
  PenLine,
  Phone,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationStep {
  id: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  detail: string;
  done: boolean;
  href?: string;
}

interface Props {
  emailVerified: boolean;
  hasPhone: boolean;
  domainVerified: boolean;
  hasSignature: boolean;
  faceLivenessVerified: boolean;
  identityDocUploaded: boolean;
}

export function VerificationProgress({
  emailVerified,
  hasPhone,
  domainVerified,
  hasSignature,
  faceLivenessVerified,
  identityDocUploaded,
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
      id: "liveness",
      icon: ScanFace,
      label: "Face liveness verified",
      detail: "Multi-pose selfie scan",
      done: faceLivenessVerified,
      href: "#clearance-liveness",
    },
    {
      id: "gov-id",
      icon: FileSearch,
      label: "Government ID uploaded",
      detail: "Passport / license for AI audit",
      done: identityDocUploaded,
      href: "#clearance-audit",
    },
    {
      id: "phone",
      icon: Phone,
      label: "Phone number",
      detail: "Optional — profile only",
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
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  const tier =
    completed === total
      ? { label: "Sovereign", color: "#D1FF00" }
      : completed >= 4
        ? { label: "Operator", color: "#38BDF8" }
        : completed >= 2
          ? { label: "Recruit", color: "#F59E0B" }
          : { label: "Unverified", color: "#6B7280" };

  return (
    <div className="rounded-sm border border-white/[0.06] bg-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">Verification status</p>
        <span
          className="ml-auto rounded px-2 py-0.5 font-mono text-xs uppercase tracking-widest"
          style={{
            color: tier.color,
            background: `${tier.color}14`,
            border: `0.5px solid ${tier.color}40`,
          }}
        >
          {tier.label}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-xs text-foreground-subtle">
            {completed} / {total} complete
          </span>
          <span className="font-mono text-xs text-foreground-subtle">{pct}%</span>
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
                    "text-xs font-medium leading-none sm:text-[11px]",
                    step.done ? "text-zinc-300" : "text-zinc-500",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs leading-none text-zinc-600">{step.detail}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
