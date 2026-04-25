import * as React from "react";
import { ShieldAlert, Globe2, ChevronRight } from "lucide-react";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

/**
 * ThreatsFeed — server-rendered list for the Admin "Global Threats"
 * panel. Pure presentation: caller passes in the rolled-up threat rows.
 */

export type ThreatRow = {
  id: string;
  technique: string;
  surface: string;
  origin: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  count: number; // occurrences in window
  at: string; // ISO last seen
};

const SEV_BG: Record<ThreatRow["severity"], string> = {
  critical: "bg-threat",
  high: "bg-threat/70",
  medium: "bg-amber-400",
  low: "bg-acid/70",
  info: "bg-steel-700",
};

const SEV_TEXT: Record<ThreatRow["severity"], string> = {
  critical: "text-threat",
  high: "text-threat-soft",
  medium: "text-amber-300",
  low: "text-acid",
  info: "text-foreground-muted",
};

export function ThreatsFeed({ rows }: { rows: ThreatRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-foreground-subtle">
        No active threats in the current window.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/[0.04]">
      {rows.map((r) => (
        <li
          key={r.id}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", SEV_BG[r.severity])}
              aria-label={r.severity}
            />
            <ShieldAlert
              size={12}
              strokeWidth={1.5}
              className={SEV_TEXT[r.severity]}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {r.technique}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                ×{r.count}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-foreground-subtle">
              <Globe2 size={10} strokeWidth={1.5} />
              <span className="text-foreground-muted">{truncate(r.surface, 36)}</span>
              <span aria-hidden>·</span>
              <span>{r.origin}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <time
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
              dateTime={r.at}
            >
              {formatRelativeTime(r.at)}
            </time>
            <ChevronRight
              size={12}
              strokeWidth={1.5}
              className="text-foreground-subtle"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
