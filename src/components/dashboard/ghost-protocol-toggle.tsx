"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ghost, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GHOST_ACCENT, GHOST_LOCK_TOOLTIP } from "@/lib/access/ghost-mode";
import { toggleGhostMode } from "@/components/dashboard/ghost-actions";
import { useSovereignStore } from "@/stores/use-sovereign-store";

const GLITCH_VARIANTS = {
  idle: { x: 0, opacity: 1, filter: "none" },
  glitch: {
    x: [0, -2, 3, -1, 0],
    opacity: [1, 0.85, 1, 0.9, 1],
    filter: [
      "none",
      "hue-rotate(90deg)",
      "none",
      "hue-rotate(-45deg)",
      "none",
    ],
    transition: { duration: 0.35, ease: "easeInOut" as const },
  },
};

interface GhostProtocolToggleProps {
  compact?: boolean;
  className?: string;
}

export function GhostProtocolToggle({
  compact = false,
  className,
}: GhostProtocolToggleProps) {
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  const canGhost = useSovereignStore((s) => s.canGhost);
  const setGhostMode = useSovereignStore((s) => s.setGhostMode);
  const activeRole = useSovereignStore((s) => s.activeRole);

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [glitchKey, setGlitchKey] = React.useState(0);

  if (activeRole !== "hacker") return null;

  async function handleToggle() {
    if (!canGhost || pending) return;
    setPending(true);
    setError(null);

    const next = !isGhostMode;
    const result = await toggleGhostMode(next);

    setPending(false);

    if ("error" in result) {
      setError(result.error ?? "Toggle failed.");
      return;
    }

    setGhostMode(result.isGhostActive);
    if (result.isGhostActive) {
      setGlitchKey((k) => k + 1);
    }
  }

  const locked = !canGhost;
  const accent = isGhostMode ? GHOST_ACCENT.primary : "#ADFF2F";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-[4px] border-[0.5px] px-2.5 py-1.5",
          compact ? "w-full justify-between" : "",
        )}
        style={{
          borderColor: isGhostMode
            ? "rgba(74,74,74,0.45)"
            : "rgba(255,255,255,0.1)",
          background: isGhostMode
            ? "rgba(74,74,74,0.12)"
            : "rgba(255,255,255,0.03)",
        }}
        title={locked ? GHOST_LOCK_TOOLTIP : undefined}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <AnimatePresence mode="wait">
            <motion.span
              key={glitchKey}
              variants={GLITCH_VARIANTS}
              initial="idle"
              animate={isGhostMode ? "glitch" : "idle"}
              className="flex items-center"
            >
              <Ghost
                size={compact ? 12 : 13}
                strokeWidth={1.5}
                style={{ color: accent }}
              />
            </motion.span>
          </AnimatePresence>
          <span
            className={cn(
              "font-mono uppercase tracking-[0.16em] text-white/80",
              compact ? "text-[9px]" : "text-[10px]",
            )}
          >
            Ghost Protocol
          </span>
        </div>

        <button
          type="button"
          disabled={locked || pending}
          onClick={() => void handleToggle()}
          aria-pressed={isGhostMode}
          aria-label={
            locked
              ? GHOST_LOCK_TOOLTIP
              : isGhostMode
                ? "Disable Ghost Protocol"
                : "Enable Ghost Protocol"
          }
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border-[0.5px] transition-colors disabled:cursor-not-allowed",
            locked && "opacity-50",
          )}
          style={{
            borderColor: locked
              ? "rgba(255,255,255,0.12)"
              : isGhostMode
                ? "rgba(74,74,74,0.6)"
                : "rgba(173,255,47,0.35)",
            background: locked ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.35)",
          }}
        >
          {locked && (
            <Lock
              size={9}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/35"
            />
          )}
          {!locked && (
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-0.5 h-4 w-4 rounded-full"
              style={{
                left: isGhostMode ? "calc(100% - 18px)" : "2px",
                background: accent,
                boxShadow: isGhostMode
                  ? `0 0 8px ${GHOST_ACCENT.glow}`
                  : "0 0 8px rgba(173,255,47,0.35)",
              }}
            />
          )}
        </button>
      </div>

      {locked && !compact && (
        <p className="font-mono text-[8px] uppercase tracking-widest text-white/30 px-0.5">
          {GHOST_LOCK_TOOLTIP}
        </p>
      )}

      {error && (
        <p className="font-mono text-[8px] text-red-400/90 truncate" title={error}>
          {error}
        </p>
      )}
    </div>
  );
}
