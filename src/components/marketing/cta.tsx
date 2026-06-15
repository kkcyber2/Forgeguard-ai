import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { buttonStyles } from "@/components/ui/button";

export interface CtaBannerProps {
  isAuthenticated: boolean;
  primaryCta: { href: string; label: string };
}

export function CtaBanner({ isAuthenticated, primaryCta }: CtaBannerProps) {
  return (
    <Section className="border-t-[0.5px] border-white/[0.04]">
      <Reveal>
        <div className="relative overflow-hidden rounded-sm border-hairline border-white/[0.08] bg-gradient-to-br from-obsidian-800 via-obsidian-900 to-obsidian-950 p-10 md:p-16">
          {/* hairline grid inside the banner */}
          <div aria-hidden className="absolute inset-0 bg-grid-hairline bg-grid-sm opacity-40" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 100% 100%, rgba(209,255,0,0.08), transparent 60%)",
            }}
          />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-eyebrow text-acid mb-4">Compliance in one afternoon</p>
              <h2 className="text-display-md text-balance text-foreground">
                Ship AI with audit-ready data protection.
              </h2>
              <p className="mt-4 text-base text-foreground-muted">
                Connect an endpoint, run a data-leak audit, export your Section A–D
                report, and deploy Aegis shields — most teams complete onboarding in a single session.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={primaryCta.href}
                className={buttonStyles({ variant: "primary", size: "lg" })}
              >
                {primaryCta.label}
                <ArrowUpRight size={16} strokeWidth={1.75} />
              </Link>
              <Link
                href={isAuthenticated ? "/dashboard/scans/new" : "/auth/signup"}
                className={buttonStyles({ variant: "secondary", size: "lg" })}
              >
                {isAuthenticated ? "Launch a scan" : "Get started free"}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
