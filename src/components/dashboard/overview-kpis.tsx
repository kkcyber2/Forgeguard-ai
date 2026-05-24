import Link from "next/link";
import { Activity, DollarSign, Radar, ShieldCheck, Store, Swords, Trophy } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

export function OverviewKpis({
  viewMode,
  hacker,
  client,
}: {
  viewMode: ViewMode;
  hacker: {
    reputation: number;
    activeMissions: number;
    recentBazaarSales: number;
  };
  client: {
    aegisRules: number;
    activeBountySpend: number;
    totalAleRisk: number;
  };
}) {
  if (viewMode === "hacker") {
    return (
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatTile
            label="REP points"
            value={hacker.reputation.toLocaleString()}
            tone="secure"
            icon={Trophy}
            footer={
              <Link
                href="/dashboard/settings"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
              >
                Operator rank
              </Link>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Active missions"
            value={hacker.activeMissions}
            tone="neutral"
            icon={Swords}
            footer={
              <Link
                href="/dashboard/missions"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
              >
                Mission feed
              </Link>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Bazaar sales (7d)"
            value={hacker.recentBazaarSales}
            tone={hacker.recentBazaarSales > 0 ? "secure" : "neutral"}
            icon={Store}
            footer={
              <Link
                href="/dashboard/bazaar"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
              >
                Open bazaar
              </Link>
            }
          />
        </StaggerItem>
      </Stagger>
    );
  }

  return (
    <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StaggerItem>
        <StatTile
          label="Aegis shield"
          value={client.aegisRules > 0 ? "Online" : "Standby"}
          tone={client.aegisRules > 0 ? "secure" : "neutral"}
          icon={ShieldCheck}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/50">
              {client.aegisRules} rule{client.aegisRules !== 1 ? "s" : ""} deployed
            </span>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          label="Active bounty spend"
          value={`$${client.activeBountySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tone="neutral"
          icon={Activity}
          footer={
            <Link
              href="/dashboard/bounties"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
            >
              Bounty management
            </Link>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          label="Total $ALE risk"
          value={
            client.totalAleRisk > 0
              ? `$${client.totalAleRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"
          }
          tone={client.totalAleRisk > 50_000 ? "threat" : "neutral"}
          icon={DollarSign}
          footer={
            <Link
              href="/dashboard/scans"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
            >
              Financial risk
            </Link>
          }
        />
      </StaggerItem>
    </Stagger>
  );
}

/** Scan-focused KPIs shown below role tiles on overview */
export function ScanOpsKpis({
  activeCount,
  blockedCount,
  breachCount,
  totalFindings,
  coveragePct,
  sealed,
  scanTotal,
  logCount,
}: {
  activeCount: number;
  blockedCount: number;
  breachCount: number;
  totalFindings: number;
  coveragePct: string;
  sealed: number;
  scanTotal: number;
  logCount: number;
}) {
  return (
    <Stagger className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StaggerItem>
        <StatTile label="Active scans" value={activeCount} tone="neutral" icon={Radar} />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          label="Probes / 24h"
          value={blockedCount}
          tone="secure"
          icon={ShieldCheck}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/50">
              {logCount} log lines
            </span>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          label="High-sev findings"
          value={breachCount}
          tone="threat"
          icon={Activity}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/50">
              {totalFindings} total
            </span>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          label="Sealed coverage"
          value={coveragePct}
          tone={sealed > 0 ? "secure" : "neutral"}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/50">
              {sealed} of {scanTotal} scans
            </span>
          }
        />
      </StaggerItem>
    </Stagger>
  );
}
