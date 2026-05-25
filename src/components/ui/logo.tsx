import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ForgeGuard AI wordmark.
 * Optional accentColor drives the pip glow for persona sync.
 */
export function Logo({
  className,
  showWordmark = true,
  accentColor = "#ADFF2F",
  glow,
}: {
  className?: string;
  showWordmark?: boolean;
  accentColor?: string;
  glow?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="square"
        aria-hidden
        style={
          glow
            ? { filter: `drop-shadow(0 0 6px ${glow})` }
            : undefined
        }
      >
        <path d="M7 2 L17 2 L22 7 L22 17 L17 22 L7 22 L2 17 L2 7 Z" />
        <path d="M15.5 9 A4 4 0 1 0 15.5 15 L12 15 L12 12" />
        <circle cx="18.5" cy="5.5" r="0.9" fill={accentColor} stroke="none" />
      </svg>
      {showWordmark ? (
        <span className="font-sans text-sm font-semibold tracking-[0.18em] uppercase">
          <span className="text-foreground">Forge</span>
          <span className="text-foreground-muted">Guard</span>
        </span>
      ) : null}
    </span>
  );
}
