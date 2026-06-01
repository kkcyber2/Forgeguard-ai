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

const PERSONA_STORAGE_KEY = "forgeguard-persona";

export const useSovereignStore = create<SovereignState>((set, get) => ({
  activeRole: "hacker",
  clearanceTier: null,
  canDev: false,
  canSwitch: false,
  isGhostMode: false,
  canGhost: false,
  operatorId: "",
  hydrated: false,
  hydrate: (payload) => {
    let role = payload.activeRole;
    if (typeof window !== "undefined" && payload.canSwitch) {
      const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
      if (stored === "client" || stored === "hacker") {
        role = stored;
      }
    }
    set({
      ...payload,
      activeRole: role,
      hydrated: true,
    });
  },
  setActiveRole: (role) => {
    if (typeof window !== "undefined" && get().canSwitch) {
      localStorage.setItem(PERSONA_STORAGE_KEY, role);
    }
    set({ activeRole: role });
  },
  setGhostMode: (active) => set({ isGhostMode: active }),
}));

/** True after SovereignProvider has hydrated client persona state. */
export function useSovereignHydrated(): boolean {
  return useSovereignStore((s) => s.hydrated);
}

export function useSovereignAccent() {
  const hydrated = useSovereignStore((s) => s.hydrated);
  const activeRole = useSovereignStore((s) => s.activeRole);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);

  if (!hydrated) {
    return SOVEREIGN_ACCENTS.hacker;
  }

  if (activeRole === "hacker" && isGhostMode) {
    return GHOST_MODE_ACCENT;
  }

  return SOVEREIGN_ACCENTS[activeRole];
}

export function useDashboardViewMode() {
  const hydrated = useSovereignStore((s) => s.hydrated);
  const activeRole = useSovereignStore((s) => s.activeRole);
  if (!hydrated) return "hacker";
  return activeRole === "client" ? "client" : "hacker";
}

export function useHackerPersonaAccent() {
  const hydrated = useSovereignStore((s) => s.hydrated);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  if (!hydrated) {
    return SOVEREIGN_ACCENTS.hacker.primary;
  }
  return isGhostMode ? GHOST_MODE_ACCENT.primary : SOVEREIGN_ACCENTS.hacker.primary;
}
