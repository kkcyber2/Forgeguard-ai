import * as React from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, Layers, Lock, Terminal } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { PLANS, CREDIT_PACKS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { isCryptoCheckoutConfigured } from "@/lib/payments/crypto";
import { isRevenueSimulationMode } from "@/lib/payments/lemon-squeezy";
import { RedeemCodeBox } from "./redeem-code-box";
import { PlanSelector } from "./plan-selector";
import { CreditPackCard } from "./credit-pack-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SubRow = {
  plan: PlanId;
  status: string;
  scans_used_this_period: number;
  period_ends_at: string | null;
};

async function getSubscription(userId: string): Promise<SubRow | null> {
  const supabase = await createServerSupabase();
  const { data } = (await supabase
    .from("subscriptions")
    .select("plan, status, scans_used_this_period, period_ends_at")
    .eq("user_id", userId)
    .maybeSingle()) as { data: SubRow | null };
  return data;
}

async function getWalletBalance(userId: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("user_wallets")
    .select("balance_usd")
    .eq("user_id", userId)
    .maybeSingle();
  return Number(data?.balance_usd ?? 0);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; gate?: string; cancelled?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/billing");

  const isSovereign = isSovereignOperator(user.email);
  const { upgraded, gate, cancelled } = await searchParams;
  const sub = await getSubscription(user.id);
  const walletBalance = await getWalletBalance(user.id);
  const creditPack = CREDIT_PACKS[0];
  const currentPlan: PlanId = sub?.plan ?? "free";
  const cryptoConfigured = isCryptoCheckoutConfigured();

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

      {upgraded && (
        <div className="mb-4 flex items-center gap-2.5 rounded-sm border border-acid/30 bg-acid/10 px-4 py-3">
          <CheckCircle2 size={14} className="shrink-0 text-acid" />
          <p className="text-sm text-acid">
            Plan upgraded successfully — your new quota is active.
          </p>
        </div>
      )}

      {cancelled && (
        <div className="mb-4 flex items-center gap-2.5 rounded-sm border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <Lock size={14} className="shrink-0 text-amber-300" />
          <p className="text-sm text-amber-300">
            Checkout was cancelled — no payment was taken. You can retry any time.
          </p>
        </div>
      )}

      {!cryptoConfigured && !isSovereign && !isRevenueSimulationMode() && (
        <div className="mb-4 rounded-sm border border-amber-400/30 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-300">
          Sovereign Vault not configured — set{" "}
          <code className="text-lime-400">NOWPAYMENTS_API_KEY</code>,{" "}
          <code className="text-lime-400">NOWPAYMENTS_IPN_SECRET</code>, and{" "}
          <code className="text-lime-400">NEXT_PUBLIC_APP_URL</code> on Vercel.
        </div>
      )}

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

          <div className="w-full max-w-xs space-y-3">
            <div>
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
            <div className="rounded-sm border border-white/[0.06] bg-obsidian-900/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                Bazaar wallet
              </p>
              <p className="font-mono text-lg font-semibold text-lime-400">
                ${walletBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-foreground-muted">
                Credit packs from ${creditPack.priceUsd} ({creditPack.credits} credits) · scan overage debits wallet
              </p>
            </div>
          </div>
        </div>

        {currentPlan !== "free" && (
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              <Terminal size={12} strokeWidth={1.75} />
              Active via Sovereign Vault · USDT / SOL / BTC
            </p>
          </div>
        )}
      </div>

      {!isSovereign && (
        <>
          <RedeemCodeBox />
          <CreditPackCard showOperatorDebug={isSovereign} />
          <PlanSelector
            plans={PLANS}
            currentPlan={currentPlan}
            userEmail={user.email ?? ""}
            userId={user.id}
            revenueSimulation={isRevenueSimulationMode()}
            showOperatorDebug={isSovereign}
          />
        </>
      )}

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-700">
        Sovereign Vault · Ghost Mode Checkout · USDT / SOL / BTC
      </p>
    </>
  );
}
