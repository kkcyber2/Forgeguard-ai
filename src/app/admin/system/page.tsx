import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  AlertTriangle,
  Zap,
  Database,
  Server,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { SystemHealth, type SystemHealthMetrics } from "@/components/dashboard/system-health";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { Sparkline } from "@/components/dashboard/sparkline";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database as DB } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "System Health" };

type ScanLogRow = DB["public"]["Tables"]["scan_logs"]["Row"];
type ScanRow = DB["public"]["Tables"]["scans"]["Row"];

/* ─────────────────────────────────────────────────────────────────────────── */

function hourlyBuckets(rows: Array<{ created_at: string }>, hours: number): number[] {
  const buckets = new Array<number>(hours).fill(0);
  const now = Date.now();
  for (const r of rows) {
    const idx = Math.floor((now - new Date(r.created_at).getTime()) / (60 * 60 * 1000));
    if (idx >= 0 && idx < hours) buckets[hours - 1 - idx] += 1;
  }
  return buckets;
}

function estimateP95Latency(rows: ScanLogRow[]): number {
  const samples: number[] = [];
  for (const r of rows) {
    if (r.type !== "attempt" && r.type !== "audit") continue;
    if (!r.payload || typeof r.payload !== "object") continue;
    const v = (r.payload as Record<string, unknown>).latency_ms;
    if (typeof v === "number" && v >= 0) samples.push(v);
  }
  if (samples.length === 0) return 0;
  samples.sort((a, b) => a - b);
  return Math.round(samples[Math.floor(0.95 * (samples.length - 1))]);
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default async function SystemPage() {
  const supabase = await createServerSupabase();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: rawLogs }, { data: rawScans }] = await Promise.all([
    supabase
      .from("scan_logs")
      .select("id, scan_id, type, severity, attack_name, payload, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("scans")
      .select("id, status, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const logs = (rawLogs ?? []) as ScanLogRow[];
  const scans = (rawScans ?? []) as Pick<ScanRow, "id" | "status" | "created_at">[];

  const logs24h = logs.filter((l) => l.created_at >= since24h);
  const scans24h = scans.filter((s) => s.created_at >= since24h);

  const queued = scans.filter((s) => s.status === "queued").length;
  const probing = scans.filter((s) => s.status === "probing").length;
  const sealed24h = scans24h.filter((s) => s.status === "sealed").length;
  const failed24h = scans24h.filter((s) => s.status === "failed").length;
  const totalRuns = sealed24h + failed24h;
  const uptime = totalRuns === 0 ? 1 : Math.max(0, 1 - failed24h / totalRuns);

  const health: SystemHealthMetrics = {
    apiLatencyP95Ms: estimateP95Latency(logs24h),
    scanWorkers: { active: probing, total: Math.max(probing, 4) },
    groqProxy: {
      status: failed24h > sealed24h ? "degraded" : "healthy",
      rps: Math.round((logs24h.length / (24 * 60 * 60)) * 10) / 10,
      sample: hourlyBuckets(logs24h, 12),
    },
    queueDepth: queued,
    uptime24h: uptime,
  };

  // Daily scan counts for the 7-day sparkline
  const dailyBuckets = new Array<number>(7).fill(0);
  const nowMs = Date.now();
  for (const s of scans) {
    const daysAgo = Math.floor((nowMs - new Date(s.created_at).getTime()) / (86400 * 1000));
    if (daysAgo >= 0 && daysAgo < 7) dailyBuckets[6 - daysAgo] += 1;
  }

  const uptimePct = Math.round(uptime * 1000) / 10;
  const errorRate = totalRuns === 0 ? 0 : Math.round((failed24h / totalRuns) * 1000) / 10;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Platform"
        title="System health"
        description="Live diagnostics for the scan worker pool, proxy layer, and database. Refreshes on every page load."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      {/* KPIs */}
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Uptime / 24h"
            value={`${uptimePct}%`}
            tone={uptimePct >= 99 ? "secure" : uptimePct >= 95 ? "neutral" : "threat"}
            icon={CheckCircle2}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {totalRuns} runs · {failed24h} failed
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Queue depth"
            value={queued}
            tone={queued > 10 ? "threat" : "neutral"}
            icon={Server}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {probing} active workers
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Probes / 24h"
            value={logs24h.length}
            tone="secure"
            icon={Zap}
            footer={<Sparkline data={hourlyBuckets(logs24h, 12)} stroke="acid" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Error rate"
            value={`${errorRate}%`}
            tone={errorRate > 5 ? "threat" : "neutral"}
            icon={AlertTriangle}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                failed / (sealed + failed)
              </span>
            }
          />
        </StaggerItem>
      </Stagger>

      {/* Health widget */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Health summary</p>
            <Badge
              tone={health.groqProxy.status === "healthy" ? "secure" : "warn"}
              className="ml-auto"
            >
              {health.groqProxy.status === "healthy" ? "All systems go" : "Degraded"}
            </Badge>
          </div>
          <SystemHealth m={health} />
        </div>

        {/* 7-day scan volume chart */}
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Cpu size={12} strokeWidth={1.75} className="text-foreground-subtle" />
            <p className="text-eyebrow text-foreground-subtle">Scan volume — 7 days</p>
          </div>
          <div className="flex h-32 items-end gap-1">
            {dailyBuckets.map((count, i) => {
              const max = Math.max(...dailyBuckets, 1);
              const pct = Math.max(4, Math.round((count / max) * 100));
              const dayLabel = new Date(Date.now() - (6 - i) * 86400 * 1000).toLocaleDateString(
                "en-US",
                { weekday: "short" },
              );
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-[2px] bg-acid/40 transition-all"
                    style={{ height: `${pct}%` }}
                    title={`${count} scans`}
                  />
                  <span className="text-[9px] text-foreground-subtle">{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-right font-mono text-[10px] text-foreground-subtle">
            {scans.length} total scans in window
          </p>
        </div>
      </div>

      {/* Latency breakdown */}
      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database size={12} strokeWidth={1.75} className="text-foreground-subtle" />
          <p className="text-eyebrow text-foreground-subtle">Latency · P95</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric
            label="API (P95)"
            value={health.apiLatencyP95Ms === 0 ? "—" : `${health.apiLatencyP95Ms}ms`}
            tone={
              health.apiLatencyP95Ms === 0
                ? "neutral"
                : health.apiLatencyP95Ms < 1000
                  ? "secure"
                  : "threat"
            }
          />
          <Metric
            label="Proxy RPS"
            value={`${health.groqProxy.rps}/s`}
            tone="neutral"
          />
          <Metric
            label="Workers active"
            value={`${health.scanWorkers.active}/${health.scanWorkers.total}`}
            tone={health.scanWorkers.active > 0 ? "secure" : "neutral"}
          />
          <Metric
            label="Queue"
            value={health.queueDepth === 0 ? "Clear" : `${health.queueDepth} pending`}
            tone={health.queueDepth > 5 ? "threat" : "secure"}
          />
        </div>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "secure" | "neutral" | "threat";
}) {
  const color =
    tone === "secure"
      ? "text-acid"
      : tone === "threat"
        ? "text-threat"
        : "text-foreground";

  return (
    <div className="rounded-sm border border-white/[0.06] bg-obsidian-800/60 p-3">
      <p className="text-[10px] text-foreground-subtle">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
