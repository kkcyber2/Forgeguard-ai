import * as React from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Lock, Plus, Radar, Terminal } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { SectionCard, SectionLink } from "@/components/dashboard/section-card";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { ScanCard } from "@/components/dashboard/scan-card";
import { RedTeamFeed } from "@/components/dashboard/red-team-feed";
import { OverviewKpis, ScanOpsKpis } from "@/components/dashboard/overview-kpis";
import { VerificationStatus } from "@/components/dashboard/VerificationStatus";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardGateModal } from "@/components/dashboard/dashboard-gate-modal";
import { resolveViewMode, type ViewMode } from "@/lib/access/parallel-sovereignty";
import type { UserType } from "@/lib/access/ranks";
import { buttonStyles } from "@/components/ui/button";
import { scansTableToCards } from "@/lib/scans/adapt";
import {
  fetchDashboardOverview,
  mapLogsToRedTeam,
} from "@/lib/dashboard/fetch-overview";
import {
  createServerSupabase,
  getCurrentProfile,
  getSessionUser,
} from "@/lib/supabase/server";

/**
 * /dashboard — User Overview.
 * Defensive rendering: all Supabase fetches are wrapped; failures degrade to []/0.
 */
export const dynamic = "force-dynamic";
export const revalidate = 5;

const GATE_COPY: Record<string, { title: string; body: string }> = {
  forge: {
    title: "Forge access requires Ghost tier (Startup+)",
    body: "The Forge workbench unlocks at access_level ≥ 3. Upgrade your plan or complete verification to run adversarial scripts in the Terminal.",
  },
  intel: {
    title: "Intel Hub requires Hacker tier",
    body: "The Intelligence Hub community chat and live threat feed are available to Hacker and Developer tiers. Complete your identity verification to gain access.",
  },
};

export default async function UserDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>;
}) {
  const sp = await searchParams;
  const gateKey = sp.gate && GATE_COPY[sp.gate] ? sp.gate : null;
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const overview = await fetchDashboardOverview(supabase, user.id);

  const userType = (overview.userType ?? "hacker") as UserType;
  const accessLevel = overview.accessLevel;
  const domainVerified = overview.domainVerified;
  const domainToken = overview.domainToken;
  const handle = (user.email ?? "").split("@")[0];
  const viewMode: ViewMode = resolveViewMode(
    profile?.active_view_mode,
    userType,
  );

  const scanRows = overview.scanRows;
  const scans = scansTableToCards(scanRows);
  const logs = mapLogsToRedTeam(overview.rawLogs);

  const activeCount = scanRows.filter(
    (s) => s.status === "queued" || s.status === "probing",
  ).length;
  const blockedCount = overview.rawLogs.filter(
    (l) => l.type === "attempt" || (l.type === "audit" && l.severity === "info"),
  ).length;
  const breachCount = overview.rawLogs.filter(
    (l) => l.type === "finding" && (l.severity === "high" || l.severity === "critical"),
  ).length;
  const totalFindings = scanRows.reduce(
    (acc, s) => acc + (s.finding_count ?? 0),
    0,
  );
  const sealed = scanRows.filter((s) => s.status === "sealed").length;
  const coveragePct =
    scanRows.length === 0
      ? "—"
      : `${Math.round((sealed / scanRows.length) * 100)}%`;

  const isEmptyDashboard = scanRows.length === 0;

  return (
    <>
      <Suspense fallback={null}>
        <DashboardGateModal />
      </Suspense>

      {isEmptyDashboard ? (
        <div className="mb-6 rounded-sm border border-border bg-surface p-6 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-subtle">
            Welcome aboard
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            Start your first audit
          </h2>
          <p className="mt-2 max-w-xl text-sm text-foreground-muted">
            Paste a target endpoint and API key — ForgeGuard begins probing immediately.
            Your dashboard, findings, and risk metrics populate after the first sealed scan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/scans/new"
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              <Plus size={14} strokeWidth={1.5} />
              Start your first audit
            </Link>
            {userType === "developer" ? (
              <Link
                href="/dashboard/integrations"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <Terminal size={14} strokeWidth={1.5} />
                CI/CD integrations
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow={dashboardEyebrow(userType, viewMode)}
        title={greeting(profile?.full_name ?? user.email ?? "Operator")}
        description={
          userType === "developer"
            ? "API keys, repository scans, and CI/CD hooks for your pipeline."
            : viewMode === "client"
              ? "Aegis shield, bounty programs, and financial risk across your AI estate."
              : "REP, missions, and bazaar velocity in your hacker workspace."
        }
        actions={
          <>
            <Link
              href="/dashboard/scans"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <Terminal size={14} strokeWidth={1.5} />
              Scan history
            </Link>
            <Link
              href="/dashboard/scans/new"
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              <Plus size={14} strokeWidth={1.5} />
              New scan
            </Link>
          </>
        }
      />

      {gateKey && GATE_COPY[gateKey] && (
        <div className="mb-5 flex items-start gap-3 rounded-[4px] border border-threat/40 bg-threat/5 px-4 py-3 text-sm">
          <Lock size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-threat" />
          <div>
            <p className="font-mono font-semibold text-threat">
              {GATE_COPY[gateKey]!.title}
            </p>
            <p className="mt-0.5 text-foreground-muted">
              {GATE_COPY[gateKey]!.body}
            </p>
          </div>
        </div>
      )}

      <OverviewKpis
        viewMode={viewMode}
        userId={user.id}
        hacker={{
          reputation: overview.reputation,
          activeMissions: overview.activeMissionCount,
          recentBazaarSales: overview.recentBazaarSales,
        }}
        client={{
          aegisRules: overview.aegisRuleCount,
          activeBountySpend: overview.activeBountySpend,
          totalAleRisk: overview.totalAleRisk,
        }}
      />

      <ScanOpsKpis
        activeCount={activeCount}
        blockedCount={blockedCount}
        breachCount={breachCount}
        totalFindings={totalFindings}
        coveragePct={coveragePct}
        sealed={sealed}
        scanTotal={scanRows.length}
        logCount={overview.rawLogs.length}
        isEmpty={isEmptyDashboard}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <SectionCard
          className="lg:col-span-3"
          eyebrow="Live"
          title="Active scans"
          description="Probes currently in flight against your registered surfaces."
          action={<SectionLink href="/dashboard/scans">All scans</SectionLink>}
        >
          {scans.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="No scans found"
              description="Start your first audit. Paste a target endpoint + API key and ForgeGuard begins probing immediately."
              action={
                <Link
                  href="/dashboard/scans/new"
                  className={buttonStyles({ variant: "primary", size: "sm" })}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Start your first audit
                </Link>
              }
            />
          ) : (
            <Stagger className="grid gap-3 md:grid-cols-2">
              {scans.map((s) => (
                <StaggerItem key={s.id}>
                  <ScanCard scan={s} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          eyebrow="Stream"
          title="Red teaming logs"
          description="Probe-by-probe outcomes from your live sandbox runs."
          action={<SectionLink href="/dashboard/scans">Open log</SectionLink>}
          density="flush"
        >
          {logs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Log feed is silent"
              description="Probe outcomes will appear here once your first scan starts emitting findings."
            />
          ) : (
            <RedTeamFeed seed={logs.slice(0, 8)} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          eyebrow="Identity"
          title="Verification Status"
          description="Your operator identity, access tier, and domain ownership proof."
        >
          <VerificationStatus
            userType={userType}
            accessLevel={accessLevel}
            domainVerified={domainVerified}
            domainToken={domainToken}
            handle={handle}
          />
        </SectionCard>
      </div>
    </>
  );
}

function dashboardEyebrow(userType: UserType, viewMode: ViewMode): string {
  if (userType === "developer") return "Developer";
  return viewMode === "client" ? "Client Sovereign" : "Researcher Sovereign";
}

function greeting(name: string): string {
  const first = name.split(/[\s@]/)[0] ?? "Operator";
  const cap = first.charAt(0).toUpperCase() + first.slice(1);
  const h = new Date().getHours();
  const tod =
    h < 5 ? "Late shift" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `${tod}, ${cap}.`;
}
