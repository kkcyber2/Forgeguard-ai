import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Radar,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/server";
import { fetchDashboardOverview } from "@/lib/dashboard/fetch-overview";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientHomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/client-home");

  const profile = await getCurrentProfile();
  if (profile?.user_type !== "client" && profile?.active_view_mode !== "client") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabase();
  const overview = await fetchDashboardOverview(supabase, user.id);

  const tiles = [
    {
      href: "/dashboard/aegis",
      label: "Aegis Shield",
      desc: "Runtime guardrails and closed-loop rules.",
      icon: <ShieldCheck size={18} className="text-[#A020F0]" />,
    },
    {
      href: "/dashboard/scans",
      label: "Scans",
      desc: "Kinetic red-team assessments on your stack.",
      icon: <Radar size={18} className="text-[#A020F0]" />,
    },
    {
      href: "/dashboard/bounties",
      label: "Bounties",
      desc: "Fund researcher payouts tied to ALE reduction.",
      icon: <ShieldAlert size={18} className="text-[#A020F0]" />,
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      desc: "Risk trends and scan velocity.",
      icon: <Activity size={18} className="text-[#A020F0]" />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#A020F0]">
          Client Sovereign
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Client Home</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Your security command surface — scans, Aegis, and bounty programs.
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Recent scans", value: overview.scanRows.length },
          { label: "Aegis rules", value: overview.aegisRuleCount },
          { label: "Bounty spend", value: `$${overview.activeBountySpend.toLocaleString()}` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-sm border border-[#A020F0]/20 bg-[#A020F0]/5 p-4"
          >
            <p className="text-eyebrow text-foreground-subtle">{kpi.label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-4 rounded-sm border border-white/[0.06] bg-surface p-5 transition-colors hover:border-[#A020F0]/30"
          >
            <div className="mt-0.5">{t.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t.label}</p>
              <p className="mt-1 text-xs text-foreground-muted">{t.desc}</p>
            </div>
            <ArrowRight
              size={14}
              className="shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
