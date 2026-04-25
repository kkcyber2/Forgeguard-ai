import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SeverityMeter — single-row stacked bar showing the distribution of
 * findings across critical / high / medium / low / info. Used in scan
 * cards and the admin Global Threats panel.
 *
 * Server-renderable. No client JS.
 */

export type SeverityCounts = {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
};

const COLORS = {
  critical: "bg-threat",
  high: "bg-threat/70",
  medium: "bg-amber-400/85",
  low: "bg-acid/75",
  info: "bg-steel-700",
} as const;

const ORDER: (keyof SeverityCounts)[] = ["critical", "high", "medium", "low", "info"];

export function SeverityMeter({
  counts,
  showLegend = false,
  className,
}: {
  counts: SeverityCounts;
  showLegend?: boolean;
  className?: string;
}) {
  const total = ORDER.reduce((acc, k) => acc + (counts[k] ?? 0), 0);

  if (total === 0) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-1.5 flex-1 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          No findings
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        {ORDER.map((k) => {
          const c = counts[k] ?? 0;
          if (c === 0) return null;
          const pct = (c / total) * 100;
          return (
            <div
              key={k}
              className={COLORS[k]}
              style={{ width: `${pct}%` }}
              title={`${k}: ${c}`}
              aria-label={`${k}: ${c}`}
            />
          );
        })}
      </div>
      {showLegend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          {ORDER.map((k) => {
            const c = counts[k] ?? 0;
            if (c === 0) return null;
            return (
              <li key={k} className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", COLORS[k])} />
                <span>{k}</span>
                <span className="font-mono text-foreground">{c}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
