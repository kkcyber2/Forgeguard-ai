import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn, formatCompact } from "@/lib/utils";
import { Badge } from "./badge";

/**
 * StatTile
 * --------
 * The only place we allow a "card-like" highlight — dense KPI tiles
 * for dashboards. Deliberately flat: no drop-shadow, top-edge highlight,
 * hairline border, optional trend indicator.
 */
export interface StatTileProps {
  label: string;
  value: string | number;
  delta?: {
    value: number; // signed: +/- percentage points
    direction: "up" | "down" | "flat";
  };
  tone?: "neutral" | "secure" | "threat" | "admin";
  icon?: LucideIcon;
  footer?: React.ReactNode;
  className?: string;
}

export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  icon: Icon,
  footer,
  className,
}: StatTileProps) {
  const valueDisplay = typeof value === "number" ? formatCompact(value) : value;
  const accent =
    tone === "secure"
      ? "text-acid"
      : tone === "threat"
      ? "text-threat"
      : tone === "admin"
      ? "text-accent-soft"
      : "text-foreground";

  return (
    <div
      className={cn(
        "group relative bg-surface rounded-sm border-hairline border-white/[0.06]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "p-5 flex flex-col gap-3 overflow-hidden",
        "transition-colors duration-200 hover:border-white/[0.12]",
        className,
      )}
    >
      {/* Corner hairline accent */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 right-0 h-px w-16 opacity-50 transition-opacity group-hover:opacity-100",
          tone === "secure"
            ? "bg-gradient-to-l from-acid to-transparent"
            : tone === "threat"
            ? "bg-gradient-to-l from-threat to-transparent"
            : tone === "admin"
            ? "bg-gradient-to-l from-accent to-transparent"
            : "bg-gradient-to-l from-white/30 to-transparent",
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          {label}
        </span>
        {Icon ? (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              tone === "secure"
                ? "text-acid"
                : tone === "threat"
                ? "text-threat"
                : tone === "admin"
                ? "text-accent-soft"
                : "text-foreground-subtle",
            )}
            strokeWidth={1.5}
          />
        ) : null}
      </div>

      <div className="flex items-baseline gap-3">
        <span className={cn("font-mono text-3xl tracking-tight font-semibold", accent)}>
          {valueDisplay}
        </span>
        {delta ? (
          <Badge
            tone={
              delta.direction === "up"
                ? tone === "threat"
                  ? "threat"
                  : "secure"
                : delta.direction === "down"
                ? tone === "threat"
                  ? "secure"
                  : "threat"
                : "neutral"
            }
          >
            {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "—"}
            {" "}
            {Math.abs(delta.value)}%
          </Badge>
        ) : null}
      </div>

      {footer ? (
        <div className="text-xs text-foreground-subtle border-t-[0.5px] border-white/[0.05] pt-3 mt-auto">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
