"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/components/dashboard/view-mode-actions";
import {
  VIEW_MODE_ACCENTS,
  type ViewMode,
} from "@/lib/access/parallel-sovereignty";

/**
 * Identity Switcher — toggles Parallel Sovereignty environments.
 * Slack/Stripe-style dual-profile control in the top nav.
 */
export function IdentitySwitcher({
  activeMode,
  canSwitch,
  compact = false,
}: {
  activeMode: ViewMode;
  canSwitch: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<ViewMode | null>(null);

  async function handleSwitch(mode: ViewMode) {
    if (!canSwitch || mode === activeMode || pending) return;
    setPending(mode);
    const result = await switchViewMode(mode);
    setPending(null);
    if (!result.error) {
      router.refresh();
    }
  }

  const accent = VIEW_MODE_ACCENTS[activeMode].primary;

  return (
    <div
      className={cn(
        "relative items-center rounded-[4px] border-[0.5px] border-white/[0.1] bg-white/[0.03] p-0.5 backdrop-blur-md",
        compact ? "flex w-full" : "hidden sm:flex",
        !canSwitch && "opacity-60",
      )}
      role="group"
      aria-label="Switch dashboard environment"
    >
      {(["client", "hacker"] as const).map((mode) => {
        const isActive = activeMode === mode;
        const isLoading = pending === mode;
        const Icon = mode === "client" ? Building2 : Terminal;
        const label = mode === "client" ? "Client" : "Hacker";

        return (
          <button
            key={mode}
            type="button"
            disabled={!canSwitch || !!pending}
            onClick={() => handleSwitch(mode)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-150",
              isActive ? "text-white" : "text-white/40 hover:text-white/65",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="identity-switcher-pill"
                className="absolute inset-0 rounded-[3px]"
                style={{
                  background: `${accent}18`,
                  border: `0.5px solid ${accent}55`,
                  boxShadow: `0 0 12px ${VIEW_MODE_ACCENTS[mode].glow}`,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon
              size={11}
              strokeWidth={1.5}
              className="relative z-[1] flex-shrink-0"
              style={isActive ? { color: accent } : undefined}
            />
            <span className="relative z-[1]">{label}</span>
            {isLoading && (
              <span className="relative z-[1] ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
            )}
          </button>
        );
      })}
    </div>
  );
}
