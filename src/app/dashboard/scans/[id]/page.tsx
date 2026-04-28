import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Cpu,
  Globe2,
  Radar,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { SeverityMeter } from "@/components/dashboard/severity-meter";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { ScanLiveLog } from "./live-log";
import { deleteScan } from "../actions";

/**
 * /dashboard/scans/[id] — single-scan detail.
 * --------------------------------------------
 * Server-rendered shell + a Client child that subscribes to Realtime
 * `scan_logs` inserts for this scan. RLS makes sure cross-tenant rows
 * never leak even if someone forges the channel name.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_TONE = {
  queued: "warn",
  probing: "live",
  triage: "warn",
  sealed: "secure",
  failed: "threat",
} as const;

const STATUS_LABEL = {
  queued: "Queued",
  probing: "Probing",
  triage: "Triage",
  sealed: "Sealed",
  failed: "Failed",
} as const;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?next=/dashboard/scans/${id}`);

  const supabase = await createServerSupabase();

  // Cast through the structural shape we actually consume here. Supabase v2
  // generic drift between `@supabase/ssr` and `@supabase/supabase-js` makes
  // this read collapse to `never` at the Next.js TS boundary; the cast keeps
  // strict-mode happy without changing any runtime behaviour.
  type ScanStatus = keyof typeof STATUS_TONE;
  type ScanDetailRow = {
    id: string;
    target_model: string;
    target_url: string;
    status: ScanStatus;
    progress_pct: number | null;
    finding_count: number | null;
    high_severity_count: number | null;
    notes: string | null;
    created_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  const { data: scan, error: scanErr } = (await supabase
    .from("scans")
    .select(
      "id, target_model, target_url, status, progress_pct, finding_count, high_severity_count, notes, created_at, started_at, completed_at",
    )
    .eq("id", id)
    .maybeSingle()) as {
    data: ScanDetailRow | null;
    error: { message: string } | null;
  };

  if (scanErr) console.error("[scans/detail] fetch:", scanErr.message);
  if (!scan) notFound();

  // Initial server snapshot of logs (most recent 100). The client child
  // takes over from here and appends Realtime events.
  const { data: logs } = await supabase
    .from("scan_logs")
    .select("id, type, severity, attack_name, payload, created_at")
    .eq("scan_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const tone = STATUS_TONE[scan.status];
  const isActive = scan.status === "probing" || scan.status === "queued";

  // Severity breakdown derived from initial logs (the live child keeps
  // its own running totals after that).
  const sevCounts = aggregateSeverity(logs ?? []);

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/scans"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={12} strokeWidth={1.75} />
          All scans
        </Link>
      </div>

      <PageHeader
        eyebrow={`scan-${scan.id.slice(0, 8)}`}
        title={scan.target_model}
        description={scan.notes ?? undefined}
        actions={
          <form action={deleteScan}>
            <input type="hidden" name="scan_id" value={scan.id} />
            <button
              type="submit"
              className={buttonStyles({ variant: "danger", size: "sm" })}
            >
              <Trash2 size={12} strokeWidth={1.75} />
              Delete
            </button>
          </form>
        }
      />

      <Stagger className="grid gap-3 md:grid-cols-4">
        <StaggerItem className="md:col-span-2">
          <Card>
            <CardHead icon={Globe2} label="Endpoint" />
            <p className="break-all font-mono text-xs text-foreground">
              {scan.target_url}
            </p>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHead icon={Cpu} label="Status" />
            <div className="flex items-center justify-between">
              <Badge tone={tone} dot={isActive}>
                {STATUS_LABEL[scan.status]}
              </Badge>
              <span className="font-mono text-xs text-foreground-muted">
                {scan.progress_pct}%
              </span>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className={
                  isActive
                    ? "h-full rounded-full bg-gradient-to-r from-acid/40 via-acid to-acid/40 bg-[length:200%_100%] animate-shimmer"
                    : tone === "secure"
                    ? "h-full rounded-full bg-acid"
                    : tone === "threat"
                    ? "h-full rounded-full bg-threat"
                    : "h-full rounded-full bg-foreground-muted"
                }
                style={{ width: `${scan.progress_pct}%` }}
              />
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHead icon={Clock} label="Timing" />
            <dl className="space-y-1 text-xs">
              <DefRow label="Created" value={formatRelativeTime(scan.created_at)} />
              <DefRow
                label="Started"
                value={
                  scan.started_at
                    ? formatRelativeTime(scan.started_at)
                    : "—"
                }
              />
              <DefRow
                label="Done"
                value={
                  scan.completed_at
                    ? formatRelativeTime(scan.completed_at)
                    : "—"
                }
              />
            </dl>
          </Card>
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHead icon={ShieldAlert} label="Findings breakdown" />
          <p className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
            {scan.finding_count}
            <span className="ml-1.5 text-xs font-normal text-foreground-subtle">
              total
            </span>
          </p>
          <SeverityMeter counts={sevCounts} showLegend />
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <CardHead icon={Radar} label="Live log" inline />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              {(logs ?? []).length} events
            </span>
          </div>
          <ScanLiveLog
            scanId={scan.id}
            initial={logs ?? []}
            createdAt={scan.created_at}
          />
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-foreground-subtle">
        Last server snapshot: {formatDateTime(new Date())}
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Local primitives                                                           */
/* -------------------------------------------------------------------------- */

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-sm border-hairline border-white/[0.06] bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

function CardHead({
  icon: Icon,
  label,
  inline,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "inline-flex items-center gap-2" : "mb-3 flex items-center gap-2"}>
      <Icon size={12} strokeWidth={1.75} className="text-foreground-subtle" />
      <span className="text-eyebrow text-foreground-subtle">{label}</span>
    </div>
  );
}

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type LogRow = {
  severity: "info" | "low" | "medium" | "high" | "critical";
  type: "progress" | "finding" | "attempt" | "audit" | "error" | "info";
};

function aggregateSeverity(rows: LogRow[]) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of rows) {
    if (r.type !== "finding") continue;
    out[r.severity] = (out[r.severity] ?? 0) + 1;
  }
  return out;
}
