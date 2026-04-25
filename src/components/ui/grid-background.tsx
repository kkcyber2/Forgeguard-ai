import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GridBackground — hairline grid + radial acid halo, drawn purely in CSS.
 * Drop into any hero / empty state. Server-safe (no client boundary).
 */
export function GridBackground({
  className,
  variant = "hero",
}: {
  className?: string;
  variant?: "hero" | "section" | "mesh";
}) {
  if (variant === "mesh") {
    return (
      <div
        aria-hidden
        className={cn("absolute inset-0 overflow-hidden", className)}
      >
        <div className="absolute inset-0 bg-grid-dense bg-grid-sm opacity-[0.4]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 20% 30%, rgba(209,255,0,0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(168,85,247,0.05), transparent 60%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-obsidian-950 to-transparent" />
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        aria-hidden
        className={cn("absolute inset-0 overflow-hidden", className)}
      >
        <div className="absolute inset-0 bg-grid-hairline bg-grid-md opacity-60" />
      </div>
    );
  }

  // hero
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-grid-hairline bg-grid-md opacity-70" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(209,255,0,0.07), transparent 60%), radial-gradient(ellipse 60% 40% at 85% 100%, rgba(168,85,247,0.04), transparent 60%)",
        }}
      />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-obsidian-950 via-obsidian-950/80 to-transparent" />
      {/* Horizon hairline */}
      <div className="absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-transparent via-acid/20 to-transparent" />
    </div>
  );
}
