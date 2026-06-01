"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { LiveWorldMapProps } from "@/components/dashboard/tactical-world-map";
import { TacticalWorldMapSkeleton } from "@/components/dashboard/tactical-world-map-skeleton";

const TacticalWorldMapLazy = dynamic(
  () =>
    import("@/components/dashboard/tactical-world-map").then(
      (m) => m.TacticalWorldMap,
    ),
  { ssr: false },
);

export type TacticalMapClientWrapperProps = {
  activeScans?: number | null;
  scanTargets?: LiveWorldMapProps["scanTargets"] | null;
  pulseNodeIds?: LiveWorldMapProps["pulseNodeIds"] | null;
  dense?: boolean;
  attackPulses?: boolean;
};

/**
 * Client-only boundary for TacticalWorldMap — safe to import from Server Components.
 */
export function TacticalMapClientWrapper({
  activeScans = 0,
  scanTargets = null,
  pulseNodeIds = null,
  dense = false,
  attackPulses = false,
}: TacticalMapClientWrapperProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <TacticalWorldMapSkeleton dense={dense} />;
  }

  return (
    <React.Suspense fallback={<TacticalWorldMapSkeleton dense={dense} />}>
      <TacticalWorldMapLazy
        activeScans={activeScans ?? 0}
        scanTargets={scanTargets ?? []}
        pulseNodeIds={pulseNodeIds ?? undefined}
        dense={dense}
        attackPulses={attackPulses}
      />
    </React.Suspense>
  );
}
