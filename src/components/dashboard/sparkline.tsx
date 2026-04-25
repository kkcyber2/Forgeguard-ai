import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sparkline — flat, hairline trend line.
 * --------------------------------------
 * Pure SVG, no client JS. Used inside StatTiles, StatusStrip, system-health
 * cards. Renders a path + an optional area gradient. The first/last point
 * never poke past the viewport so the curve always reads as a clean horizon.
 */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: "acid" | "threat" | "accent" | "muted";
  fill?: boolean;
  ariaLabel?: string;
  className?: string;
}

const STROKE: Record<NonNullable<SparklineProps["stroke"]>, string> = {
  acid: "#D1FF00",
  threat: "#FF2E4D",
  accent: "#A855F7",
  muted: "rgba(255,255,255,0.45)",
};

const FILL_GRAD: Record<NonNullable<SparklineProps["stroke"]>, string> = {
  acid: "rgba(209,255,0,0.18)",
  threat: "rgba(255,46,77,0.18)",
  accent: "rgba(168,85,247,0.18)",
  muted: "rgba(255,255,255,0.06)",
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "acid",
  fill = true,
  ariaLabel,
  className,
}: SparklineProps) {
  const gradId = `spark-${stroke}-${React.useId().replace(/:/g, "")}`;

  if (!data.length) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        className={cn("opacity-30", className)}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const area = `${path} L ${width.toFixed(2)} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      className={className}
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FILL_GRAD[stroke]} />
              <stop offset="100%" stopColor={FILL_GRAD[stroke]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
        </>
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={STROKE[stroke]}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
