import * as React from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, Layers, Lock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import {
  PLANS,
  getCustomerPortalUrl,
  getLSVariantIds,
  type PlanId,
} from "@/lib/lemonsqueezy";
import { cn } from "@/lib/utils";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { RedeemCodeBox } from "./redeem-code-box";
import { PlanSelector } from "./plan-selector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; gate?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/billing");

  const isSovereign = isSovereignOperator(user.email);
  const { upgraded, gate } = await searchParams;
  const sub = await getSubscription(user.id);
  const currentPlan: PlanId = sub?.plan ?? "free";

  let portalUrl: string | null = null;
  if (sub?.ls_customer_id && currentPlan !== "free") {
    try {
      portalUrl = await getCustomerPortalUrl(sub.ls_customer_id);
    } catch {
      // Non-fatal
    }
  }

  const { variantStartup, variantEnterprise } = getLSVariantIds();
  const variantMap: Record<PlanId, string> = {
    free: "",
    startup: variantStartup,
    enterprise: variantEnterprise,
  };

  const scansAllowed = PLANS.find((p) => p.id === currentPlan)?.scansPerMonth ?? 2;
  const scansUsed = sub?.scans_used_this_period ?? 0;
  const scanPct =
    scansAllowed >= 999_999
      ? 0
      : Math.min(100, Math.round((scansUsed / scansAllowed) * 100));

  return (
    <>
      <PageHeader
        eyebrow="billing"
        title="Plan &amp; Usage"
        description="Manage your ForgeGuard subscription and scan quota."
      />

      {isSovereign && (
        <div className="mb-6 flex items-center gap-3 rounded-sm border border-acid/40 bg-acid/10 px-4 py-3">
          <CheckCircle2 size={14} className="shrink-0 text-acid" />
          <div>
            <p className="font-mono text-[12px] font-semibold uppercase tracking-widest text-acid">
              VERIFIED: SOVEREIGN
            </p>
            <p className="font-mono text-[11px] text-steel-400">
              Payment and verification gates bypassed — unlimited enterprise
              compliance auditing and full platform access.
            </p>
          </div>
        </div>
      )}

      {/* Developer Upgrade Required gate banner */}
      {gate === "forge" && !isSovereign && (
        <div className="mb-6 flex items-center gap-3 rounded-sm border border-accent/30 bg-accent/5 px-4 py-3">
          <Lock size={14} className="shrink-0 text-accent" />
          <div>
            <p className="font-mono text-[12px] font-semibold text-accent">
              Developer Upgrade Required
            </p>
            <p className="font-mono text-[11px] text-steel-400">
              The Forge is restricted to Hacker and Developer tiers. Upgrade
              your identity to unlock adversarial script execution.
            </p>
          </div>
        </div>
      )}

      {/* Upgrade-success banner */}
      {upgraded && (
        <div className="mb-4 flex items-center gap-2.5 rounded-sm border border-acid/30 bg-acid/10 px-4 py-3">
          <CheckCircle2 size={14} className="shrink-0 text-acid" />
          <p className="text-sm text-acid">
            Plan upgraded successfully — your new quota is active.
          </p>
        </div>
      )}

      {/* Current plan card */}
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
              <span className={cn("font-medium", sub?.status === "active" ? "text-acid" : "text-amber-400")}>
                {sub?.status ?? "active"}
              </span>
              {sub?.period_ends_at && (
                <>
                  {" · "}Renews{" "}
                  {new Date(sub.period_ends_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>

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
                    scanPct >= 90 ? "bg-threat" : scanPct >= 70 ? "bg-amber-400" : "bg-acid",
                  )}
                  style={{ width: `${scanPct}%` }}
                />
              </div>
            )}
          </div>
        </div>

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

      {!isSovereign && (
        <>
          <RedeemCodeBox />
          <PlanSelector
            plans={PLANS}
            currentPlan={currentPlan}
            variantMap={variantMap}
            userEmail={user.email ?? ""}
            userId={user.id}
          />
        </>
      )}

      <p className="mt-6 text-center text-[11px] text-foreground-subtle">
        Payments are processed securely by LemonSqueezy &middot; Withdraw via Payoneer
        or Wise &middot; Cancel any time
      </p>
    </>
  );
}
