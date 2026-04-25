import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * HealthGauge — flat ring + numeric readout for system health metrics.
 * --------------------------------------------------------------------
 * Pure SVG, no client JS. Tone is derived from value vs. thresholds, so
 * a "p95 latency" gauge can flip from acid → amber → threat without the
 * caller having to compute it.
 */

export interface HealthGaugeProps {
  label: string;
  value: number; // 0..max
  max?: number;
  unit?: string;
  /** When the value crosses these, tone changes. Lower-is-better by default. */
  thresholds?: { warn: number; crit: number };
  /** Set true if higher values are healthier (e.g. uptime, throughput). */
  higherIsBetter?: boolean;
  size?: number;
  caption?: string;
  className?: string;
}

export function HealthGauge({
  label,
  value,
  max = 100,
  unit,
  thresholds,
  higherIsBetter = false,
  size = 92,
  caption,
  className,
}: HealthGaugeProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const tone = computeTone(value, thresholds, higherIsBetter);

  const stroke =
    tone === "secure"
      ? "#D1FF00"
      : tone === "warn"
      ? "#F59E0B"
      : tone === "threat"
      ? "#FF2E4D"
      : "rgba(255,255,255,0.5)";

  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Three-quarter ring: rotate -135deg and use 0.75 of circumference
  const arc = circumference * 0.75;
  const offset = arc * (1 - pct);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4",
        "rounded-sm border-hairline border-white/[0.06] bg-surface",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </span>
      <div className="relative" style={{ width: size, height: size * 0.78 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          <g transform={`rotate(-225 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.2,0.7,0.2,1)" }}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <div className="flex items-baseline gap-0.5 font-mono">
            <span
              className={cn(
                "text-xl font-semibold tracking-tight",
                tone === "secure" && "text-acid",
                tone === "warn" && "text-amber-300",
                tone === "threat" && "text-threat",
                tone === "neutral" && "text-foreground",
              )}
            >
              {formatGauge(value)}
            </span>
            {unit ? (
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                {unit}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {caption ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

function formatGauge(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

function computeTone(
  value: number,
  t: { warn: number; crit: number } | undefined,
  higherIsBetter: boolean,
): "secure" | "warn" | "threat" | "neutral" {
  if (!t) return "neutral";
  if (higherIsBetter) {
    if (value >= t.crit) return "secure";
    if (value >= t.warn) return "warn";
    return "threat";
  }
  if (value >= t.crit) return "threat";
  if (value >= t.warn) return "warn";
  return "secure";
}
