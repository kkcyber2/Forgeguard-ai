import * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Plus, Radar, ShieldCheck, Terminal } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { SectionCard, SectionLink } from "@/components/dashboard/section-card";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { ScanCard } from "@/components/dashboard/scan-card";
import { RedTeamFeed, type RedTeamLog } from "@/components/dashboard/red-team-feed";
import { Sparkline } from "@/components/dashboard/sparkline";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { buttonStyles } from "@/components/ui/button";
import { scansTableToCards } from "@/lib/scans/adapt";
import {
  createServerSupabase,
  getCurrentProfile,
  getSessionUser,
} from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

/**
 * /dashboard — User Overview.
 * ---------------------------
 * Server component. All data is RLS-scoped to the current user via the
 * request-scoped Supabase client. There are no demo seeds: if the
 * tables are empty for this user, the UI honestly shows zeros and an
 * "no scans yet" prompt.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UserDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();

  // -- Scans --------------------------------------------------------------
  const { data: scanRows, error: scanErr } = await supabase
    .from("scans")
    .select(
      "id, target_model, target_url, status, progress_pct, finding_count, high_severity_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(8) as { data: Database["public"]["Tables"]["scans"]["Row"][] | null, error: any };
  if (scanErr) console.error("[dashboard] scans:", scanErr.message);

  const scans = scansTableToCards(scanRows ?? []);

  // -- Live log slice -----------------------------------------------------
  // Pull the most recent 24h of log lines across all of this user's
  // scans. RLS on `scan_logs` (USING scan_id IN (SELECT id FROM scans
  // WHERE user_id = auth.uid())) keeps it scoped automatically.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rawLogs, error: logErr } = await supabase
    .from("scan_logs")
    .select("id, scan_id, type, severity, attack_name, payload, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50) as { data: Database["public"]["Tables"]["scan_logs"]["Row"][] | null, error: any };
  if (logErr) console.error("[dashboard] scan_logs:", logErr.message);

  const logs: RedTeamLog[] = (rawLogs ?? [])
    .map(toRedTeamLog)
    .filter((l): l is RedTeamLog => l !== null);

  // -- KPIs derived from real rows ---------------------------------------
  const activeCount = (scanRows ?? []).filter(
    (s) => s.status === "queued" || s.status === "probing",
  ).length;
  const blockedCount = (rawLogs ?? []).filter(
    (l) => l.type === "attempt" || (l.type === "audit" && l.severity === "info"),
  ).length;
  const breachCount = (rawLogs ?? []).filter(
    (l) => l.type === "finding" && (l.severity === "high" || l.severity === "critical"),
  ).length;
  const totalFindings = (scanRows ?? []).reduce(
    (acc, s) => acc + (s.finding_count ?? 0),
    0,
  );
  const sealed = (scanRows ?? []).filter((s) => s.status === "sealed").length;
  const coveragePct =
    (scanRows?.length ?? 0) === 0
      ? "—"
      : `${Math.round((sealed / (scanRows?.length ?? 1)) * 100)}%`;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title={greeting(profile?.full_name ?? user.email ?? "Operator")}
        description="Live posture across your AI surfaces. Probes run server-side and only RLS-scoped rows reach this view."
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

      {/* KPI strip */}
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Active scans"
            value={activeCount}
            tone="neutral"
            icon={Radar}
            footer={
              <Sparkline
                data={lastSevenDayCounts(scanRows ?? [], (r) =>
                  Boolean(r.created_at),
                )}
                stroke="muted"
              />
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Probes / 24h"
            value={blockedCount}
            tone="secure"
            icon={ShieldCheck}
            footer={
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {(rawLogs ?? []).length} log lines
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
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
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
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {sealed} of {(scanRows ?? []).length} scans
              </span>
            }
          />
        </StaggerItem>
      </Stagger>

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
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function greeting(name: string): string {
  const first = name.split(/[\s@]/)[0] ?? "Operator";
  const cap = first.charAt(0).toUpperCase() + first.slice(1);
  const h = new Date().getHours();
  const tod =
    h < 5 ? "Late shift" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `${tod}, ${cap}.`;
}

/** Bucket a list of rows into the last 7 days for sparkline rendering. */
function lastSevenDayCounts<T extends { created_at: string }>(
  rows: T[],
  predicate: (r: T) => boolean,
): number[] {
  const buckets = new Array(7).fill(0) as number[];
  const now = new Date();
  for (const r of rows) {
    if (!predicate(r)) continue;
    const days = Math.floor(
      (now.getTime() - new Date(r.created_at).getTime()) / (24 * 60 * 60 * 1000),
    );
    if (days >= 0 && days < 7) buckets[6 - days] += 1;
  }
  return buckets;
}

/** Map a `scan_logs` row → the RedTeamFeed shape. */
function toRedTeamLog(row: {
  id: number;
  scan_id: string;
  type: "progress" | "finding" | "attempt" | "audit" | "error" | "info";
  severity: "info" | "low" | "medium" | "high" | "critical";
  attack_name: string | null;
  payload: unknown;
  created_at: string;
}): RedTeamLog | null {
  if (row.type !== "finding" && row.type !== "attempt" && row.type !== "audit") {
    return null;
  }

  const outcome: RedTeamLog["outcome"] =
    row.type === "finding" && (row.severity === "high" || row.severity === "critical")
      ? "leaked"
      : row.type === "audit"
      ? "audit"
      : "blocked";

  return {
    id: String(row.id),
    at: row.created_at,
    technique: row.attack_name ?? row.type,
    payload: summarisePayload(row.payload),
    outcome,
    severity: row.severity,
    scanId: row.scan_id,
  };
}

function summarisePayload(p: unknown): string {
  if (p == null) return "—";
  if (typeof p === "string") return p;
  if (typeof p !== "object") return String(p);
  const r = p as Record<string, unknown>;
  if (typeof r.message === "string") return r.message;
  if (typeof r.summary === "string") return r.summary;
  if (typeof r.attack === "string") return r.attack;
  if (typeof r.probe === "string") return r.probe;
  try {
    return JSON.stringify(r).slice(0, 160);
  } catch {
    return "[unserializable]";
  }
}
