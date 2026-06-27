"use client";

import * as React from "react";
import { CheckCircle2, Loader2, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanId, PlanMeta } from "@/lib/plans";
import { createCheckoutInvoice, simulateCryptoDeposit } from "./crypto-actions";

function PlanCardClient({
  plan,
  current,
  onBuy,
  pending,
  pendingPlanId,
}: {
  plan: PlanMeta;
  current: boolean;
  onBuy: () => void;
  pending: boolean;
  pendingPlanId: PlanId | null;
}) {
  const disabled = pending || current;
  return (
    <button
      type="button"
      onClick={plan.price > 0 && !current ? onBuy : undefined}
      disabled={disabled}
      className={cn(
        "relative flex w-full flex-col rounded-sm border p-5 text-left transition-all",
        current
          ? "border-acid/30 bg-acid/5 cursor-default"
          : plan.price > 0
            ? "border-white/[0.08] bg-surface hover:border-lime-500/25 hover:shadow-[0_0_24px_rgba(132,255,0,0.04)] cursor-pointer"
            : "border-white/[0.06] bg-surface cursor-default",
      )}
    >
      {plan.badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded border border-lime-500/40 bg-black px-3 py-0.5 font-mono text-[9px] uppercase tracking-widest text-lime-400">
          {plan.badge}
        </span>
      )}

      {current && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded bg-acid/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          <ShieldCheck size={9} />
          Current plan
        </span>
      )}

      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {plan.name}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        {plan.price === 0 ? (
          <span className="text-2xl font-bold text-foreground">Free</span>
        ) : (
          <>
            <span className="text-2xl font-bold text-foreground">${plan.price}</span>
            <span className="text-xs text-zinc-500">/month · crypto</span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{plan.description}</p>

      <div className="my-3 flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
        <Zap size={10} strokeWidth={1.75} className="text-lime-400/70" />
        <span className="font-mono text-[10px] text-zinc-500">{plan.engine}</span>
      </div>

      <ul className="mb-4 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[11px] text-zinc-400">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-lime-400/60" />
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <div className="rounded-sm border border-acid/20 px-3 py-2 text-center font-mono text-[11px] text-acid">
          Active
        </div>
      ) : plan.price > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-sm border border-lime-500/25 bg-lime-500/[0.04] px-3 py-2 text-center font-mono text-[11px] text-lime-400/90">
          {pending && pendingPlanId === plan.id ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Opening checkout…
            </>
          ) : (
            "Buy with Sovereign Vault →"
          )}
        </div>
      ) : null}
    </button>
  );
}

export function PlanSelector({
  plans,
  currentPlan,
  revenueSimulation = false,
}: {
  plans: PlanMeta[];
  currentPlan: PlanId;
  userEmail?: string;
  userId?: string;
  revenueSimulation?: boolean;
  showOperatorDebug?: boolean;
}) {
  const [pendingPlanId, setPendingPlanId] = React.useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  async function buyPlan(plan: PlanMeta) {
    if (plan.price === 0 || plan.id === currentPlan) return;
    if (pendingPlanId) return;
    setCheckoutError(null);
    setPendingPlanId(plan.id);

    try {
      if (revenueSimulation && (plan.id === "startup" || plan.id === "enterprise")) {
        const result = await simulateCryptoDeposit(plan.id);
        if (!result.ok) {
          setCheckoutError(result.error);
          return;
        }
        window.location.href = "/dashboard/billing?upgraded=1";
        return;
      }

      const result = await createCheckoutInvoice({
        planName: plan.name,
        depositKind: "subscription",
      });
      if (!result.ok) {
        setCheckoutError(result.error);
        return;
      }
      // Redirect directly to the NOWPayments hosted invoice page.
      window.location.href = result.invoiceUrl;
    } finally {
      setPendingPlanId(null);
    }
  }

  return (
    <div className="space-y-6">
      {checkoutError && (
        <div className="rounded-sm border border-amber-400/30 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-300">
          {checkoutError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCardClient
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlan}
            pending={Boolean(pendingPlanId)}
            pendingPlanId={pendingPlanId}
            onBuy={() => buyPlan(plan)}
          />
        ))}
      </div>
    </div>
  );
}
