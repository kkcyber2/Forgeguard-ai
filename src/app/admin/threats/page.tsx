import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Radar,
  ShieldAlert,
  Clock,
  Globe2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { SeverityMeter } from "@/components/dashboard/severity-meter";
import { ThreatsFeed, type ThreatRow } from "@/components/dashboard/threats-feed";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { Sparkline } from "@/components/dashboard/sparkline";
import { buttonStyles } from "@/components/ui/button";
import nextDynamic from "next/dynamic";
import { TacticalWorldMapSkeleton } from "@/components/dashboard/tactical-world-map-skeleton";

const TacticalWorldMap = nextDynamic(
  () =>
    import("@/components/dashboard/tactical-world-map").then((m) => m.TacticalWorldMap),
  { ssr: false, loading: () => <TacticalWorldMapSkeleton dense /> },
);
import { createServerSupabase } from "@/lib/supabase/server";
import { severityWeight } from "@/lib/utils";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata = { title: "Global Threat Board" };

type ScanLogRow = Database["public"]["Tables"]["scan_logs"]["Row"];
type ScanRow = Database["public"]["Tables"]["scans"]["Row"];

function rollupThreats(
  rows: ScanLogRow[],
  scanIndex: Map<string, { user: string; target: string }>,
): ThreatRow[] {
  const findings = rows.filter((r) => r.type === "finding");
  const groups = new Map<string, ThreatRow>();

  for (const r of findings) {
    const meta = scanIndex.get(r.scan_id);
    const surface = meta?.target ? prettyHost(meta.target) : `scan-${r.scan_id.slice(0, 8)}`;
    const origin = meta?.user ? `op:${meta.user.slice(0, 8)}` : "unknown";
    const technique = r.attack_name ?? extractTechnique(r.payload) ?? "unknown";
    const key = `${technique}|${surface}|${r.severity}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (new Date(r.created_at) > new Date(existing.at)) existing.at = r.created_at;
    } else {
      groups.set(key, { id: String(r.id), technique, surface, origin, severity: r.severity as ThreatRow["severity"], count: 1, at: r.created_at });
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const w = severityWeight(b.severity) - severityWeight(a.severity);
    return w !== 0 ? w : new Date(b.at).getTime() - new Date(a.at).getTime();
  });
}

function extractTechnique(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const r = payload as Record<string, unknown>;
  return (typeof r.attack === "string" ? r.attack : null)
    ?? (typeof r.probe === "string" ? r.probe : null)
    ?? (typeof r.technique === "string" ? r.technique : null)
    ?? null;
}

function prettyHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 36); }
}

function hourlyBuckets(rows: Array<{ created_at: string }>, hours: number): number[] {
  const buckets = new Array<number>(hours).fill(0);
  const now = Date.now();
  for (const r of rows) {
    const idx = Math.floor((now - new Date(r.created_at).getTime()) / (60 * 60 * 1000));
    if (idx >= 0 && idx < hours) buckets[hours - 1 - idx] += 1;
  }
  return buckets;
}

export default async function ThreatsPage() {
  const supabase = await createServerSupabase();

  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rawLogs } = await supabase
    .from("scan_logs")
    .select("id, scan_id, type, severity, attack_name, payload, created_at")
    .gte("created_at", since72h)
    .order("created_at", { ascending: false })
    .limit(5000);

  const { data: scans } = await supabase
    .from("scans")
    .select("id, user_id, target_url, status")
    .limit(500) as {
    data: (Pick<ScanRow, "id" | "user_id" | "target_url"> & { status?: string })[] | null;
  };

  const activeScans = (scans ?? []).filter(
    (s) => s.status === "queued" || s.status === "probing",
  ).length;

  const logs = (rawLogs ?? []) as ScanLogRow[];
  const scanIndex = new Map((scans ?? []).map((s) => [s.id, { user: s.user_id, target: s.target_url ?? "" }]));

  const threats = rollupThreats(logs, scanIndex);
  const logs24h = logs.filter((l) => l.created_at >= since24h);

  const sevSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const t of threats) sevSummary[t.severity] += t.count;

  const totalFindings = threats.reduce((a, t) => a + t.count, 0);
  const uniqueSurfaces = new Set(threats.map((t) => t.surface)).size;
  const criticalCount = sevSummary.critical + sevSummary.high;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Threats"
        title="Global Threat Board"
        description="All probe findings across every operator — last 72 hours. Weighted by severity and deduplicated by technique."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <div className="mb-6 overflow-hidden rounded-sm border border-white/[0.06] bg-[#050505]">
        <div className="border-b border-white/[0.06] px-4 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#D1FF00]/80">
            Tactical world map · live telemetry
          </p>
        </div>
        <TacticalWorldMap activeScans={activeScans} attackPulses dense />
      </div>

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Findings / 72h"
            value={totalFindings}
            tone="neutral"
            icon={Radar}
            footer={<Sparkline data={hourlyBuckets(logs24h, 12)} stroke="acid" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Critical + High"
            value={criticalCount}
            tone="threat"
            icon={ShieldAlert}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {sevSummary.critical} critical · {sevSummary.high} high
              </span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Unique surfaces"
            value={uniqueSurfaces}
            tone="neutral"
            icon={Globe2}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">distinct endpoints</span>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Probes / 24h"
            value={logs24h.length}
            tone="secure"
            icon={Clock}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {logs.length - logs24h.length} in prior 48h
              </span>
            }
          />
        </StaggerItem>
      </Stagger>

      {threats.length > 0 && (
        <div className="mt-6 rounded-sm border border-white/[0.06] bg-surface p-4">
          <p className="mb-3 text-eyebrow text-foreground-subtle">Severity distribution</p>
          <SeverityMeter counts={sevSummary} showLegend />
        </div>
      )}

      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <p className="text-sm font-medium text-foreground">
            All findings{" "}
            <span className="ml-1 font-mono text-xs text-foreground-muted">
              ({threats.length} unique techniques)
            </span>
          </p>
        </div>
        {threats.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="No findings in window"
            description="Once operators run scans, probe findings roll up here in real time."
          />
        ) : (
          <ThreatsFeed rows={threats} />
        )}
      </div>
    </>
  );
}
