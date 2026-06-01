"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { LiveWorldMapProps } from "@/components/dashboard/tactical-world-map";
import { TacticalWorldMapSkeleton } from "@/components/dashboard/tactical-world-map-skeleton";

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
  const LazyMap = React.useMemo(
    () =>
      dynamic(
        () =>
          import("@/components/dashboard/tactical-world-map").then(
            (m) => m.TacticalWorldMap,
          ),
        {
          ssr: false,
          loading: () => <TacticalWorldMapSkeleton dense={dense} />,
        },
      ),
    [dense],
  );

  return (
    <LazyMap
      activeScans={activeScans ?? 0}
      scanTargets={scanTargets ?? []}
      pulseNodeIds={pulseNodeIds ?? undefined}
      dense={dense}
      attackPulses={attackPulses}
    />
  );
}
