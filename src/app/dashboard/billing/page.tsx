import * as React from "react";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import {
  PLANS,
  buildCheckoutUrl,
  getCustomerPortalUrl,
  getLSVariantIds,
  type PlanId,
  type PlanMeta,
} from "@/lib/lemonsqueezy";
import { cn } from "@/lib/utils";
import { RedeemCodeBox } from "./redeem-code-box";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Data                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

type SubRow = {
  plan: PlanId;
  status: string;
  scans_used_this_period: number;
  period_ends_at: string | null;
  ls_subscription_id: string | null;
  ls_customer_id: string | null;
};

async function getSubscription(userId: string): Promise<SubRow | null> {
  const supabase = await createServerSupabase();
  const { data } = (await supabase
    .from("subscriptions")
    .select(
      "plan, status, scans_used_this_period, period_ends_at, ls_subscription_id, ls_customer_id",
    )
    .eq("user_id", userId)
    .maybeSingle()) as { data: SubRow | null };
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/billing");

  const { upgraded } = await searchParams;
  const sub = await getSubscription(user.id);
  const currentPlan: PlanId = sub?.plan ?? "free";

  // Portal URL for manage-billing button (only for paid plans with a LS customer)
  let portalUrl: string | null = null;
  if (sub?.ls_customer_id && currentPlan !== "free") {
    try {
      portalUrl = await getCustomerPortalUrl(sub.ls_customer_id);
    } catch {
      // Non-fatal — button just won't show if LS is unreachable
    }
  }

  // Checkout URLs for upgrade buttons — getLSVariantIds() never throws
  // (it doesn't require the API key, only the variant IDs from env).
  const { variantStartup, variantEnterprise } = getLSVariantIds();

  const variantMap: Record<PlanId, string> = {
    free: "",
    startup:    variantStartup,
    enterprise: variantEnterprise,
  };

  const scansAllowed = PLANS.find((p) => p.id === currentPlan)?.scansPerMonth ?? 2;
  const scansUsed    = sub?.scans_used_this_period ?? 0;
  const scanPct      = scansAllowed >= 999_999
    ? 0
    : Math.min(100, Math.round((scansUsed / scansAllowed) * 100));

  return (
    <>
      <PageHeader
        eyebrow="billing"
        title="Plan &amp; Usage"
        description="Manage your ForgeGuard subscription and scan quota."
      />

      {/* ── Upgrade-success banner ── */}
      {upgraded && (
        <div className="mb-4 flex items-center gap-2.5 rounded-sm border border-acid/30 bg-acid/10 px-4 py-3">
          <CheckCircle2 size={14} className="shrink-0 text-acid" />
          <p className="text-sm text-acid">
            Plan upgraded successfully — your new quota is active.
          </p>
        </div>
      )}

      {/* ── Current plan card ── */}
      <div className="mb-6 rounded-sm border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers size={12} strokeWidth={1.75} className="text-foreground-subtle" />
          <span className="text-eyebrow text-foreground-subtle">Current plan</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground capitalize">
              {PLANS.find((p) => p.id === currentPlan)?.name ?? "Hacker"}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Status:{" "}
              <span
                className={cn(
                  "font-medium",
                  sub?.status === "active" ? "text-acid" : "text-amber-400",
                )}
              >
                {sub?.status ?? "active"}
              </span>
              {sub?.period_ends_at && (
                <>
                  {" · "}Renews{" "}
                  {new Date(sub.period_ends_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>

          {/* Scan usage meter */}
          <div className="w-full max-w-xs">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-foreground-muted">
              <span>Scans this period</span>
              <span className="font-mono">
                {scansUsed} / {scansAllowed >= 999_999 ? "∞" : scansAllowed}
              </span>
            </div>
            {scansAllowed < 999_999 && (
              <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    scanPct >= 90
                      ? "bg-threat"
                      : scanPct >= 70
                        ? "bg-amber-400"
                        : "bg-acid",
                  )}
                  style={{ width: `${scanPct}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Manage billing / cancel */}
        {portalUrl && (
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-foreground-muted transition-colors hover:text-foreground"
            >
              <CreditCard size={12} strokeWidth={1.75} />
              Manage billing &amp; cancel subscription
            </a>
          </div>
        )}
      </div>

      {/* ── Promo code box ── */}
      <RedeemCodeBox />

      {/* ── Plan cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlan}
            variantId={variantMap[plan.id]}
            userEmail={user.email ?? ""}
            userId={user.id}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-foreground-subtle">
        Payments are processed securely by LemonSqueezy · Withdraw via Payoneer
        or Wise · Cancel any time
      </p>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PlanCard                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function PlanCard({
  plan,
  current,
  variantId,
  userEmail,
  userId,
}: {
  plan: PlanMeta;
  current: boolean;
  variantId: string;
  userEmail: string;
  userId: string;
}) {
  const checkoutUrl =
    variantId && !current
      ? buildCheckoutUrl(variantId, userEmail, userId)
      : null;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-sm border p-5 transition-colors",
        current
          ? "border-acid/30 bg-acid/5"
          : plan.badge
            ? "border-white/[0.12] bg-surface"
            : "border-white/[0.06] bg-surface",
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded border border-acid/40 bg-black px-3 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          {plan.badge}
        </span>
      )}

      {/* Current pill */}
      {current && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded bg-acid/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
          <ShieldCheck size={9} />
          Current plan
        </span>
      )}

      {/* Name + price */}
      <p className="text-xs font-semibold uppercase tracking-widest text-foreground-subtle">
        {plan.name}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        {plan.price === 0 ? (
          <span className="text-2xl font-bold text-foreground">Free</span>
        ) : (
          <>
            <span className="text-2xl font-bold text-foreground">
              ${plan.price}
            </span>
            <span className="text-xs text-foreground-muted">/month</span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-muted">
        {plan.description}
      </p>

      {/* Engine badge */}
      <div className="my-3 flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
        <Zap size={10} strokeWidth={1.75} className="text-acid/70" />
        <span className="font-mono text-[10px] text-foreground-muted">
          {plan.engine}
        </span>
      </div>

      {/* Features */}
      <ul className="mb-4 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[11px] text-foreground-muted">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-acid/60" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {current ? (
        <div className="rounded-sm border border-acid/20 px-3 py-2 text-center font-mono text-[11px] text-acid">
          Active
        </div>
      ) : checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "block rounded-sm border px-3 py-2 text-center text-[11px] font-semibold transition-colors",
            plan.id === "startup"
              ? "border-acid/50 bg-acid/10 text-acid hover:bg-acid/20"
              : "border-white/[0.1] text-foreground-muted hover:border-white/[0.2] hover:text-foreground",
          )}
        >
          Upgrade to {plan.name} →
        </a>
      ) : plan.price > 0 ? (
        <div className="rounded-sm border border-white/[0.06] px-3 py-2 text-center font-mono text-[10px] text-foreground-subtle">
          Checkout coming soon — contact support
        </div>
      ) : null}
    </div>
  );
}
