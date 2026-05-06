import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GitCompare, ShieldAlert, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * /dashboard/scans/compare?a=<id>&b=<id>
 * ----------------------------------------
 * Side-by-side diff of two sealed scan reports.
 * Shows CVSS delta, severity breakdown comparison,
 * new findings, and resolved findings.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

interface ScanRow {
  id: string;
  target_model: string;
  target_url: string;
  status: string;
  created_at: string | null;
}

interface Finding {
  id: string;
  family: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cvss: number;
  summary?: string;
}

interface ReportRow {
  scan_id: string;
  cvss_overall: number | null;
  risk_label: string | null;
  findings: Finding[] | null;
  attacks_run: number | null;
}

const SEVERITY_ORDER: Finding["severity"][] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

const SEV_COLOR: Record<string, string> = {
  critical: "text-threat",
  high: "text-orange-400",
  medium: "text-amber-300",
  low: "text-acid",
  info: "text-foreground-muted",
};

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "text-threat",
  HIGH: "text-orange-400",
  MEDIUM: "text-amber-300",
  LOW: "text-acid",
  NONE: "text-foreground-muted",
};

export default async function ComparePage({ searchParams }: PageProps) {
  const { a, b } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/scans/compare");

  if (!a || !b) {
    return (
      <div className="mt-12 text-center">
        <GitCompare size={32} className="mx-auto mb-3 text-foreground-subtle" />
        <p className="text-sm text-foreground-muted">
          Provide two scan IDs via{" "}
          <code className="font-mono text-foreground">?a=&lt;id&gt;&amp;b=&lt;id&gt;</code>
        </p>
        <Link
          href="/dashboard/scans"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={12} />
          Back to scans
        </Link>
      </div>
    );
  }

  const supabase = await createServerSupabase();

  // Fetch both scans (RLS ensures they belong to the user)
  const [{ data: scanA }, { data: scanB }] = await Promise.all([
    supabase
      .from("scans")
      .select("id, target_model, target_url, status, created_at")
      .eq("id", a)
      .maybeSingle() as Promise<{ data: ScanRow | null }>,
    supabase
      .from("scans")
      .select("id, target_model, target_url, status, created_at")
      .eq("id", b)
      .maybeSingle() as Promise<{ data: ScanRow | null }>,
  ]);

  if (!scanA || !scanB) {
    return (
      <div className="mt-12 text-center">
        <p className="text-sm text-foreground-muted">
          One or both scans not found.
        </p>
        <Link
          href="/dashboard/scans"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={12} />
          Back to scans
        </Link>
      </div>
    );
  }

  // Fetch both reports
  const [{ data: reportA }, { data: reportB }] = await Promise.all([
    supabase
      .from("scan_reports")
      .select("scan_id, cvss_overall, risk_label, findings, attacks_run")
      .eq("scan_id", a)
      .maybeSingle() as Promise<{ data: ReportRow | null }>,
    supabase
      .from("scan_reports")
      .select("scan_id, cvss_overall, risk_label, findings, attacks_run")
      .eq("scan_id", b)
      .maybeSingle() as Promise<{ data: ReportRow | null }>,
  ]);

  const findingsA: Finding[] = reportA?.findings ?? [];
  const findingsB: Finding[] = reportB?.findings ?? [];

  // Build sets of family keys for diff
  const familiesA = new Set(findingsA.map((f) => `${f.family}:${f.severity}`));
  const familiesB = new Set(findingsB.map((f) => `${f.family}:${f.severity}`));

  const newInB = findingsB.filter((f) => !familiesA.has(`${f.family}:${f.severity}`));
  const resolvedInB = findingsA.filter((f) => !familiesB.has(`${f.family}:${f.severity}`));
  const sharedCount = findingsB.filter((f) => familiesA.has(`${f.family}:${f.severity}`)).length;

  const cvssA = reportA?.cvss_overall ?? 0;
  const cvssB = reportB?.cvss_overall ?? 0;
  const cvssDelta = cvssB - cvssA;

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
        eyebrow="Analysis"
        title="Scan Comparison"
        description="Side-by-side diff — see what changed between two red-team runs."
      />

      {/* ── CVSS delta banner ── */}
      <div className="mb-4 flex items-center gap-4 rounded-sm border border-white/[0.06] bg-surface p-5">
        <ShieldAlert size={16} className="shrink-0 text-foreground-subtle" />
        <div className="flex-1">
          <p className="text-[11px] text-foreground-muted">CVSS delta</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {cvssA.toFixed(1)}
            </span>
            <span className="text-foreground-subtle">→</span>
            <span className="font-mono text-2xl font-bold text-foreground">
              {cvssB.toFixed(1)}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 font-mono text-sm font-semibold",
                cvssDelta > 0
                  ? "text-threat"
                  : cvssDelta < 0
                    ? "text-acid"
                    : "text-foreground-muted",
              )}
            >
              {cvssDelta > 0 ? (
                <TrendingUp size={14} />
              ) : cvssDelta < 0 ? (
                <TrendingDown size={14} />
              ) : (
                <Minus size={14} />
              )}
              {cvssDelta > 0 ? "+" : ""}
              {cvssDelta.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <p className="font-mono text-lg font-bold text-threat">{newInB.length}</p>
            <p className="text-foreground-subtle">New</p>
          </div>
          <div>
            <p className="font-mono text-lg font-bold text-acid">{resolvedInB.length}</p>
            <p className="text-foreground-subtle">Resolved</p>
          </div>
          <div>
            <p className="font-mono text-lg font-bold text-foreground">{sharedCount}</p>
            <p className="text-foreground-subtle">Persisting</p>
          </div>
        </div>
      </div>

      {/* ── Side-by-side scan cards ── */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        {[
          { scan: scanA, report: reportA, label: "Scan A (baseline)" },
          { scan: scanB, report: reportB, label: "Scan B (latest)" },
        ].map(({ scan, report, label }) => (
          <div
            key={scan.id}
            className="rounded-sm border border-white/[0.06] bg-surface p-5"
          >
            <p className="mb-1 text-eyebrow text-foreground-subtle">{label}</p>
            <Link
              href={`/dashboard/scans/${scan.id}`}
              className="font-mono text-xs text-foreground-muted hover:text-foreground"
            >
              {scan.id.slice(0, 8)}…
            </Link>
            <p className="mt-1 text-sm font-medium text-foreground">
              {scan.target_model}
            </p>
            <p className="truncate font-mono text-[11px] text-foreground-muted">
              {scan.target_url}
            </p>

            {report ? (
              <>
                <div className="mt-4 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-mono text-3xl font-bold",
                      RISK_COLOR[report.risk_label ?? "NONE"] ?? "text-foreground",
                    )}
                  >
                    {(report.cvss_overall ?? 0).toFixed(1)}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase",
                      RISK_COLOR[report.risk_label ?? "NONE"] ?? "text-foreground",
                    )}
                  >
                    {report.risk_label ?? "NONE"}
                  </span>
                </div>

                {/* Severity breakdown */}
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {SEVERITY_ORDER.map((sev) => {
                    const count = (report.findings ?? []).filter(
                      (f) => f.severity === sev,
                    ).length;
                    return (
                      <div key={sev} className="text-center">
                        <p
                          className={cn(
                            "font-mono text-base font-bold",
                            SEV_COLOR[sev],
                          )}
                        >
                          {count}
                        </p>
                        <p className="text-[9px] uppercase text-foreground-subtle">
                          {sev.slice(0, 4)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-4 text-xs text-foreground-muted">
                Report not available (scan may not be sealed).
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── New findings ── */}
      {newInB.length > 0 && (
        <FindingDiffSection
          title="New findings in Scan B"
          subtitle="These attack families were not present in the baseline."
          findings={newInB}
          tone="threat"
        />
      )}

      {/* ── Resolved findings ── */}
      {resolvedInB.length > 0 && (
        <FindingDiffSection
          title="Resolved since Scan A"
          subtitle="These findings are no longer detected — verify the fix holds."
          findings={resolvedInB}
          tone="secure"
        />
      )}

      {newInB.length === 0 && resolvedInB.length === 0 && (
        <div className="rounded-sm border border-white/[0.06] bg-surface p-8 text-center">
          <Minus size={20} className="mx-auto mb-2 text-foreground-subtle" />
          <p className="text-sm text-foreground-muted">
            No change in finding families between the two scans.
          </p>
        </div>
      )}
    </>
  );
}

/* ── Sub-component ── */

function FindingDiffSection({
  title,
  subtitle,
  findings,
  tone,
}: {
  title: string;
  subtitle: string;
  findings: Finding[];
  tone: "threat" | "secure";
}) {
  const borderClass =
    tone === "threat" ? "border-threat/20" : "border-acid/20";
  const headClass = tone === "threat" ? "text-threat" : "text-acid";

  return (
    <div className={cn("mb-4 rounded-sm border bg-surface p-5", borderClass)}>
      <p className={cn("text-xs font-semibold", headClass)}>{title}</p>
      <p className="mb-3 text-[11px] text-foreground-muted">{subtitle}</p>
      <div className="space-y-2">
        {findings.map((f) => (
          <div
            key={`${f.id}-${f.family}`}
            className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <div>
              <p className="text-xs font-medium text-foreground">{f.family}</p>
              {f.summary && (
                <p className="truncate text-[11px] text-foreground-muted">
                  {f.summary}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 pl-3">
              <span
                className={cn(
                  "font-mono text-sm font-bold",
                  SEV_COLOR[f.severity],
                )}
              >
                {f.cvss.toFixed(1)}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase",
                  SEV_COLOR[f.severity],
                )}
              >
                {f.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
