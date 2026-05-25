"use client";

import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { Sparkline } from "@/components/dashboard/sparkline";
import { SeverityMeter } from "@/components/dashboard/severity-meter";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Activity,
  AlertTriangle,
  Radar,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { DashboardAnalytics } from "@/lib/analytics/dashboard-metrics";

export function AnalyticsCharts({ data }: { data: DashboardAnalytics }) {
  return (
    <div className="space-y-6">
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile label="Scans (30d)" value={data.totalScans} tone="neutral" icon={Radar} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Completed"
            value={data.completedScans}
            tone="secure"
            icon={Activity}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="High-severity scans"
            value={data.highSeverityScans}
            tone="threat"
            icon={AlertTriangle}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Total findings"
            value={data.totalFindings}
            tone="neutral"
            icon={TrendingUp}
          />
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-3 lg:grid-cols-3">
        <StaggerItem>
          <div
            className="rounded-sm border-[0.5px] border-white/[0.08] p-5"
            style={{ background: "#050505" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Scan volume — 30 day trend
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <Sparkline
                data={data.scanTrend}
                width={280}
                height={48}
                stroke="acid"
                ariaLabel="Scan volume trend"
              />
              <span className="font-mono text-2xl tabular-nums text-acid">
                {data.totalScans}
              </span>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div
            className="rounded-sm border-[0.5px] border-white/[0.08] p-5"
            style={{ background: "#050505" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Operator growth — 30 day trend
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <Sparkline
                data={data.operatorTrend}
                width={280}
                height={48}
                stroke="accent"
                ariaLabel="Operator growth trend"
              />
              <span className="font-mono text-2xl tabular-nums text-violet-300">
                {data.operatorsTotal}
              </span>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div
            className="rounded-sm border-[0.5px] border-white/[0.08] p-5"
            style={{ background: "#050505" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Threats blocked — 30 day trend
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <Sparkline
                data={data.threatsBlockedTrend}
                width={280}
                height={48}
                stroke="threat"
                ariaLabel="Threats blocked trend"
              />
              <span className="font-mono text-2xl tabular-nums text-red-400">
                {data.threatsBlockedTotal}
              </span>
            </div>
          </div>
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-3 lg:grid-cols-3">
        <StaggerItem>
          <div
            className="rounded-sm border-[0.5px] border-white/[0.08] p-5 lg:col-span-2"
            style={{ background: "#050505" }}
          >
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Finding severity distribution
            </p>
            <SeverityMeter counts={data.severityCounts} showLegend />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div
            className="space-y-3 rounded-sm border-[0.5px] border-white/[0.08] p-5"
            style={{ background: "#050505" }}
          >
            <StatTile
              label="Operators this week"
              value={data.operatorsWeek}
              tone="neutral"
              icon={Users}
            />
            <StatTile
              label="Platform tx (30d)"
              value={`$${data.txVolumeUsd.toFixed(0)}`}
              tone="secure"
              icon={Wallet}
            />
            <p className="font-mono text-[10px] text-foreground-subtle">
              {data.txCount} ledger entries · {data.failedScans} failed scans
            </p>
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
