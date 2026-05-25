"use client";

import * as React from "react";
import {
  useSovereignStore,
  useSovereignAccent,
  type SovereignHydratePayload,
} from "@/stores/use-sovereign-store";

export function SovereignProvider({
  initial,
  children,
}: {
  initial: SovereignHydratePayload;
  children: React.ReactNode;
}) {
  const hydrate = useSovereignStore((s) => s.hydrate);
  const activeRole = useSovereignStore((s) => s.activeRole);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  const hydrated = useSovereignStore((s) => s.hydrated);
  const accent = useSovereignAccent();

  React.useEffect(() => {
    hydrate(initial);
  }, [hydrate, initial]);

  React.useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.style.setProperty("--sovereign-accent", accent.primary);
    root.style.setProperty("--sovereign-glow", accent.glow);
  }, [activeRole, isGhostMode, accent, hydrated]);

  return <>{children}</>;
}
