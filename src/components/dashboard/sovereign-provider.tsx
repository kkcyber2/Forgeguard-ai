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
  const setMounted = useSovereignStore((s) => s.setMounted);
  const activeRole = useSovereignStore((s) => s.activeRole);
  const isGhostMode = useSovereignStore((s) => s.isGhostMode);
  const hydrated = useSovereignStore((s) => s.hydrated);
  const mounted = useSovereignStore((s) => s.mounted);
  const accent = useSovereignAccent();
  const [clientReady, setClientReady] = React.useState(false);

  React.useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      setClientReady(true);
      setMounted(true);
    }
    return () => setMounted(false);
  }, [setMounted]);

  React.useEffect(() => {
    hydrate(initial);
  }, [hydrate, initial]);

  React.useEffect(() => {
    if (!hydrated || !mounted) return;
    const root = document.documentElement;
    root.style.setProperty("--sovereign-accent", accent.primary);
    root.style.setProperty("--sovereign-glow", accent.glow);
    root.setAttribute("data-persona", activeRole === "dev" ? "dev" : activeRole);
  }, [activeRole, isGhostMode, accent, hydrated, mounted]);

  if (!clientReady) {
    return (
      <div
        className="min-h-0 animate-pulse bg-obsidian-950/40"
        aria-hidden="true"
      />
    );
  }

  return <>{children}</>;
}
