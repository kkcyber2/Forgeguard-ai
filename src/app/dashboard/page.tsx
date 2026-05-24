import * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Lock, Plus, Radar, ShieldCheck, Terminal } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { SectionCard, SectionLink } from "@/components/dashboard/section-card";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { ScanCard } from "@/components/dashboard/scan-card";
import { RedTeamFeed, type RedTeamLog } from "@/components/dashboard/red-team-feed";
import { OverviewKpis, ScanOpsKpis } from "@/components/dashboard/overview-kpis";
import { VerificationStatus } from "@/components/dashboard/VerificationStatus";
import { EmptyState } from "@/components/dashboard/empty-state";
import { resolveViewMode, type ViewMode } from "@/lib/access/parallel-sovereignty";
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

// ─── Gate banner config ────────────────────────────────────────────────────
const GATE_COPY: Record<string, { title: string; body: string }> = {
  forge: {
    title: "Forge access requires Hacker tier",
    body:  "The Forge workbench is available to Hacker and Developer identity tiers. Upgrade your identity in the Verification Status panel below to unlock adversarial script execution.",
  },
  intel: {
    title: "Intel Hub requires Hacker tier",
    body:  "The Intelligence Hub community chat and live threat feed are available to Hacker and Developer tiers. Complete your identity verification to gain access.",
  },
};

export default async function UserDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>;
}) {
  // Next.js 15: searchParams is a Promise and must be awaited.
  const sp = await searchParams;
  const gateKey = sp.gate && GATE_COPY[sp.gate] ? sp.gate : null;
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();

  // -- Identity fields (Sprint 8) ----------------------------------------
  const { data: identityRow } = await supabase
    .from("profiles")
    .select(
      "user_type, access_level, domain_verified, domain_token, active_view_mode, reputation",
    )
    .eq("id", user.id)
    .single();
  const userType      = (identityRow?.user_type as "client" | "hacker" | "developer" | null) ?? null;
  const accessLevel   = (identityRow?.access_level as number) ?? 1;
  const domainVerified= Boolean(identityRow?.domain_verified);
  const domainToken   = (identityRow?.domain_token as string | null) ?? null;
  const handle        = (user.email ?? "").split("@")[0];
  const viewMode: ViewMode = resolveViewMode(
    identityRow?.active_view_mode,
    userType,
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: userScanIds } = await supabase
    .from("scans")
    .select("id")
    .eq("user_id", user.id);
  const scanIds = (userScanIds ?? []).map((s) => s.id);

  const [
    { count: activeMissionCount },
    { count: recentBazaarSales },
    { count: aegisRuleCount },
    { data: escrowRows },
    { data: aleScans },
  ] = await Promise.all([
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("bazaar_purchases")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .gte("created_at", sevenDaysAgo),
    scanIds.length > 0
      ? supabase
          .from("aegis_rules")
          .select("id", { count: "exact", head: true })
          .in("scan_id", scanIds)
      : Promise.resolve({ count: 0, data: null, error: null }),
    supabase
      .from("bounty_escrow")
      .select("amount_usd, status")
      .eq("user_id", user.id)
      .eq("status", "held"),
    supabase
      .from("scans")
      .select("ale_usd")
      .eq("user_id", user.id),
  ]);

  const activeBountySpend = (escrowRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount_usd ?? 0),
    0,
  );
  const totalAleRisk = (aleScans ?? []).reduce(
    (sum, row) => sum + Number(row.ale_usd ?? 0),
    0,
  );

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
    .map((row) => toRedTeamLog(row as Parameters<typeof toRedTeamLog>[0]))
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
        eyebrow={viewMode === "client" ? "Client Sovereign" : "Hacker Sovereign"}
        title={greeting(profile?.full_name ?? user.email ?? "Operator")}
        description={
          viewMode === "client"
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

      {/* Identity gate banner — shown when redirected from a gated route */}
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
        hacker={{
          reputation: identityRow?.reputation ?? 0,
          activeMissions: activeMissionCount ?? 0,
          recentBazaarSales: recentBazaarSales ?? 0,
        }}
        client={{
          aegisRules: aegisRuleCount ?? 0,
          activeBountySpend,
          totalAleRisk,
        }}
      />

      <ScanOpsKpis
        activeCount={activeCount}
        blockedCount={blockedCount}
        breachCount={breachCount}
        totalFindings={totalFindings}
        coveragePct={coveragePct}
        sealed={sealed}
        scanTotal={(scanRows ?? []).length}
        logCount={(rawLogs ?? []).length}
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

      {/* ── Verification Status ─────────────────────────────────────────── */}
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
