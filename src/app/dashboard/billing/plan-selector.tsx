"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanId, PlanMeta } from "@/lib/lemonsqueezy-client";
import {
  getStripeHostedCheckoutUrl,
  resolveStripeCheckoutUrl,
} from "@/lib/payments/stripe";
import { simulateSubscriptionCheckout } from "./checkout-actions";

/* ─────────────────────────── helpers ─────────────────────────────────── */

function fmtCardNumber(raw: string) {
  return raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function fmtExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function detectNetwork(num: string): "visa" | "mc" | "amex" | "unknown" {
  const d = num.replace(/\D/g, "");
  if (d.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mc";
  if (/^3[47]/.test(d)) return "amex";
  return "unknown";
}

/* ────────────────────────── card face ────────────────────────────────── */

function CardFace({
  number,
  name,
  expiry,
  cvv,
  flipped,
}: {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  flipped: boolean;
}) {
  const net = detectNetwork(number);

  const displayNumber = number.padEnd(19, " ").replace(/\d(?=.{0,3}$)/g, (c, i, str) => {
    // show last 4, mask the rest with •
    const raw = number.replace(/\D/g, "");
    if (raw.length < 4) return c;
    return i < str.length - 4 ? "•" : c;
  });

  // Build groups: "•••• •••• •••• XXXX"
  function buildGroups() {
    const raw = number.replace(/\D/g, "").padEnd(16, "·");
    const groups = [];
    for (let i = 0; i < 16; i += 4) {
      const chunk = raw.slice(i, i + 4);
      const filled = number.replace(/\D/g, "").slice(i, i + 4);
      if (i < 12) {
        // mask if digits not yet typed
        const displayed = chunk.split("").map((ch, j) => {
          const absIdx = i + j;
          return absIdx < number.replace(/\D/g, "").length ? filled[j] : "·";
        });
        groups.push(displayed.join(""));
      } else {
        groups.push(chunk);
      }
    }
    return groups.join("  ");
  }

  return (
    <div className="relative h-44 w-full perspective-[1000px]">
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* Front */}
        <div className="absolute inset-0 overflow-hidden rounded-[10px] [backface-visibility:hidden]">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-acid/[0.04] via-transparent to-transparent" />
          {/* Grid noise */}
          <div className="absolute inset-0 opacity-[0.04] [background-image:repeating-linear-gradient(0deg,transparent,transparent_31px,rgba(255,255,255,.6)_31px,rgba(255,255,255,.6)_32px),repeating-linear-gradient(90deg,transparent,transparent_31px,rgba(255,255,255,.6)_31px,rgba(255,255,255,.6)_32px)]" />
          {/* Border */}
          <div className="absolute inset-0 rounded-[10px] border border-white/[0.08]" />

          {/* Chip */}
          <div className="absolute left-5 top-5">
            <div className="h-8 w-11 rounded-[4px] border border-amber-300/30 bg-gradient-to-br from-amber-200/20 to-amber-400/10 backdrop-blur-sm">
              <div className="mt-[10px] mx-[4px] h-[1px] w-[calc(100%-8px)] bg-amber-300/20" />
              <div className="mt-[4px] mx-[8px] h-[1px] w-[calc(100%-16px)] bg-amber-300/20" />
            </div>
          </div>

          {/* Network logo */}
          <div className="absolute right-5 top-4">
            {net === "visa" && (
              <span className="font-serif text-lg font-bold italic text-white/60 tracking-tight">VISA</span>
            )}
            {net === "mc" && (
              <div className="flex items-center">
                <div className="h-6 w-6 rounded-full bg-[#eb001b]/70" />
                <div className="-ml-3 h-6 w-6 rounded-full bg-[#f79e1b]/70" />
              </div>
            )}
            {net === "amex" && (
              <span className="font-mono text-xs font-bold text-white/50 tracking-widest">AMEX</span>
            )}
            {net === "unknown" && (
              <div className="flex items-center gap-1 opacity-30">
                <div className="h-5 w-5 rounded-full border border-white/40" />
                <div className="-ml-2.5 h-5 w-5 rounded-full border border-white/40" />
              </div>
            )}
          </div>

          {/* ForgeGuard mark */}
          <div className="absolute left-5 bottom-14">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-acid/40">
              ForgeGuard
            </span>
          </div>

          {/* Card number */}
          <div className="absolute inset-x-5 bottom-8">
            <p className="font-mono text-[15px] tracking-[0.22em] text-white/80">
              {buildGroups()}
            </p>
          </div>

          {/* Name + Expiry */}
          <div className="absolute inset-x-5 bottom-2 flex items-end justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50 truncate max-w-[60%]">
              {name || "CARDHOLDER NAME"}
            </p>
            <p className="font-mono text-[10px] tracking-wider text-white/50">
              {expiry || "MM/YY"}
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 overflow-hidden rounded-[10px] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0a0a0a]" />
          <div className="absolute inset-0 rounded-[10px] border border-white/[0.08]" />
          {/* Magnetic stripe */}
          <div className="absolute inset-x-0 top-8 h-10 bg-gradient-to-r from-[#1a1a1a] via-[#111] to-[#1a1a1a]" />
          {/* Signature strip */}
          <div className="absolute inset-x-5 top-[86px] flex items-center gap-3">
            <div className="h-8 flex-1 rounded-[2px] bg-white/[0.06] px-3 py-1">
              <div className="h-full w-full flex items-center justify-end">
                <span className="font-mono text-xs font-bold text-foreground/60">{cvv || "···"}</span>
              </div>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">CVV</span>
          </div>
          <div className="absolute inset-x-5 bottom-4">
            <p className="font-mono text-[8px] text-white/20 text-center">
              Payments processed securely by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── payment form ──────────────────────────────────── */

function PaymentForm({
  checkoutUrl,
  planName,
  simulation,
  onSimulate,
}: {
  checkoutUrl: string;
  planName: string;
  simulation?: boolean;
  onSimulate?: () => void;
}) {
  const [cardNumber, setCardNumber] = React.useState("");
  const [cardName, setCardName] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvv, setCvv] = React.useState("");
  const [focused, setFocused] = React.useState<"cvv" | null>(null);

  const inputBase =
    "w-full rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 font-mono text-[13px] text-foreground placeholder:text-foreground-subtle outline-none transition-colors focus:border-acid/40 focus:bg-white/[0.05]";

  return (
    <div className="space-y-5">
      <CardFace
        number={cardNumber}
        name={cardName}
        expiry={expiry}
        cvv={cvv}
        flipped={focused === "cvv"}
      />

      <div className="space-y-3">
        {/* Card number */}
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
            Card number
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="1234  5678  9012  3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(fmtCardNumber(e.target.value))}
              maxLength={19}
              className={inputBase}
            />
            <CreditCard
              size={13}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
            />
          </div>
        </div>

        {/* Cardholder name */}
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
            Cardholder name
          </label>
          <input
            type="text"
            placeholder="Ada Lovelace"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            maxLength={26}
            className={inputBase}
          />
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
              Expiry
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
              maxLength={5}
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-foreground-subtle">
              CVV
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="···"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onFocus={() => setFocused("cvv")}
              onBlur={() => setFocused(null)}
              maxLength={4}
              className={inputBase}
            />
          </div>
        </div>
      </div>

      {/* SSL badge */}
      <div className="flex items-center gap-2 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <Lock size={11} strokeWidth={1.5} className="shrink-0 text-acid/60" />
        <p className="font-mono text-[10px] text-foreground-subtle">
          Your card details are not stored. Checkout is secured by Stripe.
        </p>
      </div>

      {/* CTA — Stripe Hosted Checkout or simulation */}
      {simulation ? (
        <button
          type="button"
          onClick={onSimulate}
          className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-acid/50 bg-acid/10 px-4 py-2.5 font-mono text-[12px] font-semibold text-acid transition-colors hover:bg-acid/20"
        >
          Simulate Upgrade — {planName} (REVENUE_SIMULATION_MODE)
        </button>
      ) : (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-acid/50 bg-acid/10 px-4 py-2.5 font-mono text-[12px] font-semibold text-acid transition-colors hover:bg-acid/20"
        >
          Continue to Stripe Checkout — {planName} &rarr;
        </a>
      )}
    </div>
  );
}

/* ────────────────────── plan card (client) ───────────────────────────── */

function PlanCardClient({
  plan,
  current,
  selected,
  onSelect,
  onCheckout,
  checkoutPending,
}: {
  plan: PlanMeta;
  current: boolean;
  selected: boolean;
  onSelect: () => void;
  onCheckout: () => void;
  checkoutPending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        plan.price > 0 && !current
          ? () => {
              onSelect();
              onCheckout();
            }
          : undefined
      }
      disabled={checkoutPending && plan.price > 0 && !current}
      className={cn(
        "relative flex w-full flex-col rounded-sm border p-5 text-left transition-all",
        current
          ? "border-acid/30 bg-acid/5 cursor-default"
          : selected
            ? "border-acid/50 bg-acid/[0.07] shadow-[0_0_0_1px_rgba(209,255,0,0.15)]"
            : plan.price > 0
              ? "border-white/[0.08] bg-surface hover:border-white/[0.16] cursor-pointer"
              : "border-white/[0.06] bg-surface cursor-default",
      )}
    >
      {plan.badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded border border-acid/40 bg-black px-3 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          {plan.badge}
        </span>
      )}

      {current && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded bg-acid/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          <ShieldCheck size={9} />
          Current plan
        </span>
      )}

      {selected && !current && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded bg-acid/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          <CheckCircle2 size={9} />
          Selected
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
            <span className="text-xs text-zinc-500">/month</span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{plan.description}</p>

      <div className="my-3 flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
        <Zap size={10} strokeWidth={1.75} className="text-acid/70" />
        <span className="font-mono text-[10px] text-zinc-500">{plan.engine}</span>
      </div>

      <ul className="mb-4 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[11px] text-zinc-400">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-acid/60" />
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <div className="rounded-sm border border-acid/20 px-3 py-2 text-center font-mono text-[11px] text-acid">
          Active
        </div>
      ) : plan.price > 0 ? (
        <div
          className={cn(
            "rounded-sm border px-3 py-2 text-center font-mono text-[11px] transition-colors",
            selected
              ? "border-acid/50 bg-acid/10 text-acid"
              : "border-white/[0.1] text-zinc-500",
          )}
        >
          {selected ? "Selected ✓" : `Select ${plan.name}`}
        </div>
      ) : null}
    </button>
  );
}

/* ──────────────────────── main export ───────────────────────────────── */

export function PlanSelector({
  plans,
  currentPlan,
  userEmail,
  userId,
  revenueSimulation = false,
}: {
  plans: PlanMeta[];
  currentPlan: PlanId;
  userEmail: string;
  userId: string;
  revenueSimulation?: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = React.useState<PlanId | null>(null);
  const [checkoutPending, setCheckoutPending] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  const activePlan = selectedPlan ?? null;
  const activeMeta = activePlan ? plans.find((p) => p.id === activePlan) : null;

  async function handlePlanCheckout(planId: PlanId) {
    if (planId === "free" || planId === currentPlan) return;

    setCheckoutError(null);
    setCheckoutPending(true);

    try {
      if (revenueSimulation && (planId === "startup" || planId === "enterprise")) {
        const result = await simulateSubscriptionCheckout(planId);
        if (!result.ok) {
          setCheckoutError(result.error);
          return;
        }
        window.location.href = "/dashboard/billing?upgraded=1";
        return;
      }

      const url = resolveStripeCheckoutUrl(planId, userId, userEmail);
      if (url) {
        window.location.href = url;
        return;
      }

      const startup = getStripeHostedCheckoutUrl("startup");
      const sovereign = getStripeHostedCheckoutUrl("enterprise");
      setCheckoutError(
        planId === "startup"
          ? `Configure NEXT_PUBLIC_STRIPE_CHECKOUT_STARTUP${startup ? "" : " on Vercel"}`
          : `Configure NEXT_PUBLIC_STRIPE_CHECKOUT_SOVEREIGN${sovereign ? "" : " on Vercel"}`,
      );
    } finally {
      setCheckoutPending(false);
    }
  }

  const checkoutUrl =
    activePlan && (activePlan === "startup" || activePlan === "enterprise")
      ? resolveStripeCheckoutUrl(activePlan, userId, userEmail)
      : null;

  const showPayment =
    !!activePlan && activePlan !== "free" && (!!checkoutUrl || revenueSimulation);

  return (
    <div className="space-y-6">
      {checkoutError && (
        <div className="rounded-sm border border-amber-400/30 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-300">
          {checkoutError}
        </div>
      )}
      {/* Plan grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCardClient
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlan}
            selected={selectedPlan === plan.id}
            checkoutPending={checkoutPending}
            onSelect={() =>
              setSelectedPlan((prev) => (prev === plan.id ? null : plan.id))
            }
            onCheckout={() => void handlePlanCheckout(plan.id)}
          />
        ))}
      </div>

      {/* Payment card — slides in when paid plan is selected */}
      <AnimatePresence>
        {showPayment && activeMeta && (checkoutUrl || revenueSimulation) && (
          <motion.div
            key="payment-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-sm border border-white/[0.08] bg-obsidian-900/60 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-3">
              <CreditCard size={12} strokeWidth={1.5} className="text-acid/60" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Payment details
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded border border-acid/20 bg-acid/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
                {activeMeta.name} — ${activeMeta.price}/mo
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              {/* Left: form */}
              <div className="border-b border-white/[0.06] p-6 md:border-b-0 md:border-r">
                <PaymentForm
                  checkoutUrl={
                    checkoutUrl ??
                    (activePlan === "startup"
                      ? (process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_STARTUP ?? "#")
                      : (process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_SOVEREIGN ?? "#"))
                  }
                  planName={activeMeta.name}
                  simulation={revenueSimulation}
                  onSimulate={() => void handlePlanCheckout(activePlan!)}
                />
              </div>

              {/* Right: plan summary */}
              <div className="p-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">
                  Order summary
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-[12px] text-zinc-400">{activeMeta.name} plan</span>
                    <span className="font-mono text-[12px] text-foreground">${activeMeta.price}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-[12px] text-zinc-400">Billing cycle</span>
                    <span className="font-mono text-[11px] text-zinc-400">Monthly</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-[12px] text-zinc-400">Scans / month</span>
                    <span className="font-mono text-[11px] text-zinc-300">
                      {activeMeta.scansPerMonth >= 999_999 ? "Unlimited" : activeMeta.scansPerMonth}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[13px] font-semibold text-foreground">Total due today</span>
                    <span className="font-mono text-[14px] font-bold text-acid">${activeMeta.price}</span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
                    What's included
                  </p>
                  {activeMeta.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-acid/60" />
                      <span className="text-[11px] text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2 rounded-[4px] border border-white/[0.06] bg-white/[0.02] p-3">
                  <Lock size={11} className="shrink-0 text-zinc-600" />
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Cancel any time from the billing portal. No lock-in.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
