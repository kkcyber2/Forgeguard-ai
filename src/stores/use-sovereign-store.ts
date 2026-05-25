import { create } from "zustand";
import {
  SOVEREIGN_ACCENTS,
  type SovereignRole,
} from "@/lib/access/parallel-sovereignty";
import { GHOST_ACCENT as GHOST_MODE_ACCENT } from "@/lib/access/ghost-mode";

export interface SovereignHydratePayload {
  activeRole: SovereignRole;
  clearanceTier: string | null;
  canDev: boolean;
  canSwitch: boolean;
  isGhostMode: boolean;
  canGhost: boolean;
  operatorId: string;
}

interface SovereignState extends SovereignHydratePayload {
  hydrated: boolean;
  hydrate: (payload: SovereignHydratePayload) => void;
  setActiveRole: (role: SovereignRole) => void;
  setGhostMode: (active: boolean) => void;
}

export const useSovereignStore = create<SovereignState>((set) => ({
  activeRole: "hacker",
  clearanceTier: null,
  canDev: false,
  canSwitch: false,
  isGhostMode: false,
  canGhost: false,
  operatorId: "",
  hydrated: false,
  hydrate: (payload) =>
    set({
      ...payload,
      hydrated: true,
    }),
  setActiveRole: (role) => set({ activeRole: role }),
  setGhostMode: (active) => set({ isGhostMode: active }),
}));

export function useSovereignAccent() {
  const activeRole = useSovereignStore((s) => s.activeRole);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);

  if (activeRole === "hacker" && isGhostMode) {
    return GHOST_MODE_ACCENT;
  }

  return SOVEREIGN_ACCENTS[activeRole];
}

export function useDashboardViewMode() {
  const activeRole = useSovereignStore((s) => s.activeRole);
  return activeRole === "client" ? "client" : "hacker";
}

/** Hacker tab accent when ghost protocol is active */
export function useHackerPersonaAccent() {
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  return isGhostMode ? GHOST_MODE_ACCENT.primary : SOVEREIGN_ACCENTS.hacker.primary;
}
