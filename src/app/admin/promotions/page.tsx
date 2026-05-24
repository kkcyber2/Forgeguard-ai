import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Gift, Tag, ShieldCheck, Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { buttonStyles } from "@/components/ui/button";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PromoManager } from "./promo-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "Promotions" };

type PromoRow = {
  id: string;
  code: string;
  target_plan: string;
  uses_left: number;
  expires_at: string | null;
  created_at: string;
};

type RedeemedRow = {
  id: string;
  redeemed_at: string;
};

export default async function PromotionsPage() {
  // ── Admin guard ──────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  // ── Data ─────────────────────────────────────────────────────────────────
  const admin = createAdminSupabase();

  const { data: promos } = (await admin
    .from("promo_codes")
    .select("id, code, target_plan, uses_left, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200)) as { data: PromoRow[] | null };

  const { data: redeemed } = (await admin
    .from("redeemed_codes")
    .select("id, redeemed_at")) as { data: RedeemedRow[] | null };

  const promoList = promos ?? [];
  const redeemedList = redeemed ?? [];

  // KPI calculations
  const totalCodes = promoList.length;
  const activeCodes = promoList.filter((p) => p.uses_left > 0).length;
  const totalRedemptions = redeemedList.length;
  const recentRedemptions = redeemedList.filter(
    (r) =>
      new Date(r.redeemed_at) >
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Growth"
        title="Promotions"
        description="Create and manage promo codes for plan access grants."
        actions={
          <Link
            href="/admin"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      {/* KPIs */}
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile label="Total codes" value={totalCodes} tone="neutral" icon={Tag} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Active codes" value={activeCodes} tone="secure" icon={ShieldCheck} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Total redemptions"
            value={totalRedemptions}
            tone="neutral"
            icon={Gift}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Redeemed this week"
            value={recentRedemptions}
            tone="neutral"
            icon={Clock}
          />
        </StaggerItem>
      </Stagger>

      {/* Manager */}
      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface p-5">
        <PromoManager promos={promoList} />
      </div>

      <p className="mt-4 text-center text-[11px] text-foreground-subtle">
        Each code grants 30-day plan access. Revoking sets uses_left to 0 immediately.
      </p>
    </>
  );
}
