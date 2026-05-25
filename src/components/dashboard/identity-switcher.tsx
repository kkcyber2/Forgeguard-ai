"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Cpu, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { switchPersona } from "@/components/dashboard/view-mode-actions";
import {
  SOVEREIGN_ACCENTS,
  type SovereignRole,
} from "@/lib/access/parallel-sovereignty";
import { useSovereignStore, useHackerPersonaAccent } from "@/stores/use-sovereign-store";

const PERSONA_MODES: Array<{
  role: SovereignRole;
  label: string;
  Icon: typeof Building2;
}> = [
  { role: "client", label: "Client", Icon: Building2 },
  { role: "hacker", label: "Hacker", Icon: Terminal },
  { role: "dev", label: "Dev", Icon: Cpu },
];

/**
 * Persona Switcher — toggles CLIENT / HACKER / DEV environments.
 * Syncs Zustand store + Supabase profiles.current_persona.
 */
export function IdentitySwitcher({
  activeMode: activeModeProp,
  canSwitch: canSwitchProp,
  compact = false,
}: {
  activeMode?: SovereignRole;
  canSwitch?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const storeRole = useSovereignStore((s) => s.activeRole);
  const canDev = useSovereignStore((s) => s.canDev);
  const canSwitchStore = useSovereignStore((s) => s.canSwitch);
  const setActiveRole = useSovereignStore((s) => s.setActiveRole);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  const hackerAccent = useHackerPersonaAccent();

  const activeMode = activeModeProp ?? storeRole;
  const canSwitch = canSwitchProp ?? canSwitchStore;

  const [pending, setPending] = React.useState<SovereignRole | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSwitch(role: SovereignRole) {
    if (!canSwitch || role === activeMode || pending) return;
    if (role === "dev" && !canDev) return;

    setPending(role);
    setError(null);
    setActiveRole(role);

    const result = await switchPersona(role);
    setPending(null);

    if (result.error) {
      setActiveRole(activeMode);
      setError(result.error);
      return;
    }

    if (result.redirectTo) {
      router.push(result.redirectTo);
    }
    router.refresh();
  }

  const accent =
    activeMode === "hacker" && isGhostMode
      ? hackerAccent
      : SOVEREIGN_ACCENTS[activeMode].primary;
  const visibleModes = PERSONA_MODES.filter((m) => m.role !== "dev" || canDev);

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          "relative items-center rounded-[4px] border-[0.5px] border-white/[0.1] bg-white/[0.03] p-0.5 backdrop-blur-md",
          compact ? "flex w-full" : "hidden sm:flex",
          !canSwitch && "opacity-60",
        )}
        role="group"
        aria-label="Switch dashboard persona"
      >
        {visibleModes.map(({ role, label, Icon }) => {
          const isActive = activeMode === role;
          const isLoading = pending === role;
          const isDisabled = !canSwitch || !!pending || (role === "dev" && !canDev);
          const modeAccent =
            role === "hacker" && isGhostMode
              ? hackerAccent
              : SOVEREIGN_ACCENTS[role].primary;

          return (
            <button
              key={role}
              type="button"
              disabled={isDisabled}
              title={
                role === "dev" && !canDev
                  ? "Requires Sovereign clearance"
                  : undefined
              }
              onClick={() => handleSwitch(role)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-150",
                isActive ? "text-white" : "text-white/40 hover:text-white/65",
                role === "dev" && !canDev && "cursor-not-allowed opacity-40",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="identity-switcher-pill"
                  className="absolute inset-0 rounded-[3px]"
                  style={{
                    background: `${accent}18`,
                    border: `0.5px solid ${accent}55`,
                    boxShadow: `0 0 12px ${SOVEREIGN_ACCENTS[role].glow}`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                size={11}
                strokeWidth={1.5}
                className="relative z-[1] flex-shrink-0"
                style={isActive ? { color: modeAccent } : undefined}
              />
              <span className="relative z-[1]">{label}</span>
              {isLoading && (
                <span className="relative z-[1] ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <span
          className="max-w-[200px] truncate font-mono text-[8px] text-[#FF3131]/90"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}

/** Alias for plan naming */
export const PersonaSwitcher = IdentitySwitcher;
