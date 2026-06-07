"use client";

import * as React from "react";
import { CheckCircle2, Zap, Shield } from "lucide-react";
import { PLANS, type PlanMeta } from "@/lib/plans";
import { resolveMarketingPlanCheckout } from "@/lib/lemonsqueezy-client";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PricingSection — rendered on the marketing landing page                     */
/*  Client component so we can handle hover state without SSR mismatch.         */
/* ─────────────────────────────────────────────────────────────────────────── */

export function PricingSection({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  return (
    <section id="pricing" className="relative py-24">
      {/* Subtle background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(209,255,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(209,255,0,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6">
        {/* Heading */}
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-subtle">
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Protect your AI stack.{" "}
            <span className="text-acid">Audit-ready pricing.</span>
          </h2>
          <p className="mt-3 text-sm text-foreground-muted">
            Pay via{" "}
            <span className="text-foreground/70">LemonSqueezy</span>
            {" · "}Withdraw via{" "}
            <span className="text-foreground/70">Payoneer</span> or{" "}
            <span className="text-foreground/70">Wise</span>
            {" · "}Works worldwide including{" "}
            <span className="text-foreground/70">Pakistan</span>.
          </p>
        </div>

        {/* Plan grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>

        {/* Fine-print */}
        <p className="mt-8 text-center text-[11px] text-foreground-subtle">
          All plans include full data-integrity assessment coverage · Cancel anytime ·
          No contracts
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Individual card                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function PricingCard({
  plan,
  isAuthenticated,
}: {
  plan: PlanMeta;
  isAuthenticated: boolean;
}) {
  const highlighted = plan.id === "startup";

  const lsCheckout =
    plan.id === "startup" || plan.id === "enterprise"
      ? resolveMarketingPlanCheckout(plan.id)
      : null;

  const ctaHref =
    plan.price === 0
      ? isAuthenticated
        ? "/dashboard"
        : "/auth/signup"
      : lsCheckout ?? (isAuthenticated ? "/dashboard/billing" : "/auth/signup");

  const ctaExternal = Boolean(lsCheckout && plan.price > 0);

  const ctaLabel =
    plan.price === 0
      ? isAuthenticated
        ? "Your current plan"
        : "Get started free"
      : isAuthenticated
        ? `Upgrade to ${plan.name}`
        : `Start with ${plan.name}`;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-sm border p-6 transition-all duration-300",
        highlighted
          ? [
              "border-acid/60",
              "bg-acid/[0.04]",
              // multi-layer glow: tight inner + wide outer
              "shadow-[0_0_0_1px_rgba(209,255,0,0.15),0_0_24px_rgba(209,255,0,0.18),0_0_64px_rgba(209,255,0,0.08)]",
              "hover:shadow-[0_0_0_1px_rgba(209,255,0,0.25),0_0_32px_rgba(209,255,0,0.26),0_0_80px_rgba(209,255,0,0.12)]",
            ].join(" ")
          : "border-white/[0.06] bg-surface hover:border-white/[0.12] hover:shadow-[0_0_16px_rgba(255,255,255,0.03)]",
      )}
    >
      {/* Acid Green top-edge accent bar for highlighted card */}
      {highlighted && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(209,255,0,0.8) 40%, rgba(209,255,0,1) 50%, rgba(209,255,0,0.8) 60%, transparent)",
          }}
        />
      )}

      {/* Popular badge */}
      {plan.badge && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-acid/60 bg-obsidian px-3 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-acid shadow-[0_0_12px_rgba(209,255,0,0.3)]">
          {plan.badge}
        </span>
      )}

      {/* Plan name */}
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-foreground-subtle">
        {plan.name}
      </p>

      {/* Price */}
      <div className="mb-2 flex items-baseline gap-1">
        {plan.price === 0 ? (
          <span className="text-3xl font-bold text-foreground">Free</span>
        ) : (
          <>
            <span
              className={cn(
                "text-3xl font-bold",
                highlighted ? "text-acid" : "text-foreground",
              )}
            >
              ${plan.price}
            </span>
            <span className="text-xs text-foreground-muted">/month</span>
          </>
        )}
      </div>

      <p className="mb-4 text-[11px] leading-relaxed text-foreground-muted">
        {plan.description}
      </p>

      {/* Engine chip */}
      <div
        className={cn(
          "mb-4 flex items-center gap-1.5 rounded border px-2.5 py-1.5",
          highlighted
            ? "border-acid/20 bg-acid/[0.06]"
            : "border-white/[0.06] bg-black/30",
        )}
      >
        <Zap
          size={10}
          strokeWidth={1.75}
          className={highlighted ? "text-acid" : "text-foreground-subtle"}
        />
        <span className="font-mono text-[10px] text-foreground-muted">
          {plan.engine}
        </span>
      </div>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[11px] text-foreground-muted"
          >
            <CheckCircle2
              size={11}
              className={cn(
                "mt-0.5 shrink-0",
                highlighted ? "text-acid/80" : "text-foreground-subtle",
              )}
            />
            {f}
          </li>
        ))}
      </ul>

      {/* API badge for Enterprise */}
      {plan.apiAccess && (
        <div className="mb-3 flex items-center gap-1.5 rounded border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
          <Shield size={10} strokeWidth={1.75} className="text-foreground-subtle" />
          <span className="font-mono text-[10px] text-foreground-muted">
            REST API access included
          </span>
        </div>
      )}

      {/* CTA */}
      <a
        href={ctaHref}
        target={ctaExternal ? "_blank" : undefined}
        rel={ctaExternal ? "noopener noreferrer" : undefined}
        className={cn(
          "block rounded-sm border px-4 py-2.5 text-center text-[12px] font-semibold transition-all duration-200",
          highlighted
            ? "border-acid bg-acid text-obsidian hover:bg-acid/90 hover:shadow-[0_0_16px_rgba(209,255,0,0.4)]"
            : plan.price === 0 && isAuthenticated
              ? "cursor-default border-white/[0.06] text-foreground-subtle"
              : "border-white/[0.1] text-foreground-muted hover:border-white/[0.2] hover:text-foreground",
        )}
      >
        {ctaExternal ? `Subscribe — $${plan.price}/mo` : ctaLabel}
      </a>
    </div>
  );
}
