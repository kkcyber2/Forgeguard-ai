import * as React from "react";
import Link from "next/link";
import { Radar, GitBranch, ChevronRight, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SeverityMeter, type SeverityCounts } from "./severity-meter";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

/**
 * ScanCard — one row in the "Active Scans" grid.
 * ----------------------------------------------
 * Server-renderable. Status pill is derived from the submission status,
 * the progress bar is a heuristic (pending → 15%, in_progress → 65%,
 * review → 90%) so the UI stays useful before we plumb a real progress
 * column through.
 */

export interface ScanCardData {
  id: string;
  target: string;
  service: string;
  status: "pending" | "in_progress" | "review" | "completed" | "rejected" | "cancelled";
  startedAt: string;
  findings?: SeverityCounts;
  href?: string;
}

const STATUS_LABEL: Record<ScanCardData["status"], string> = {
  pending: "Queued",
  in_progress: "Probing",
  review: "Triage",
  completed: "Sealed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<ScanCardData["status"], "live" | "secure" | "warn" | "neutral" | "threat"> = {
  pending: "warn",
  in_progress: "live",
  review: "warn",
  completed: "secure",
  rejected: "threat",
  cancelled: "neutral",
};

const STATUS_PROGRESS: Record<ScanCardData["status"], number> = {
  pending: 12,
  in_progress: 64,
  review: 88,
  completed: 100,
  rejected: 100,
  cancelled: 100,
};

export function ScanCard({ scan }: { scan: ScanCardData }) {
  const tone = STATUS_TONE[scan.status];
  const progress = STATUS_PROGRESS[scan.status];
  const isActive = scan.status === "in_progress" || scan.status === "pending";

  const wrapperClass = cn(
    "group relative block bg-surface rounded-sm border-hairline border-white/[0.06]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    "p-5 transition-colors duration-200",
    "hover:border-white/[0.14] hover:bg-obsidian-800/50",
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-hairline",
              isActive
                ? "border-acid/30 bg-acid-wash text-acid"
                : "border-white/10 bg-obsidian-800 text-foreground-subtle",
            )}
          >
            {isActive ? (
              <Radar size={14} strokeWidth={1.5} className="animate-pulse-acid" />
            ) : (
              <Square size={12} strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-eyebrow text-foreground-subtle">{scan.service}</p>
            <h3 className="mt-0.5 truncate text-sm font-medium text-foreground">
              {truncate(scan.target, 64)}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-foreground-subtle">
              <GitBranch size={10} strokeWidth={1.5} />
              <span className="truncate">scan-{scan.id.slice(0, 8)}</span>
              <span aria-hidden>·</span>
              <time>{formatRelativeTime(scan.startedAt)}</time>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge tone={tone} dot={isActive}>
            {STATUS_LABEL[scan.status]}
          </Badge>
          <ChevronRight
            size={14}
            strokeWidth={1.5}
            className="text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "secure"
                ? "bg-acid"
                : tone === "threat"
                ? "bg-threat"
                : tone === "warn"
                ? "bg-amber-400"
                : "bg-foreground-muted",
              isActive && "bg-gradient-to-r from-acid/40 via-acid to-acid/40 bg-[length:200%_100%] animate-shimmer",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          <span>{progress}% complete</span>
          <span>
            {findingsTotal(scan.findings)} findings
          </span>
        </div>
      </div>

      {scan.findings && findingsTotal(scan.findings) > 0 ? (
        <div className="mt-4">
          <SeverityMeter counts={scan.findings} />
        </div>
      ) : null}
    </>
  );

  if (scan.href) {
    return (
      <Link href={scan.href} className={wrapperClass}>
        {body}
      </Link>
    );
  }
  return <article className={wrapperClass}>{body}</article>;
}

function findingsTotal(c?: SeverityCounts): number {
  if (!c) return 0;
  return (c.critical ?? 0) + (c.high ?? 0) + (c.medium ?? 0) + (c.low ?? 0) + (c.info ?? 0);
}
