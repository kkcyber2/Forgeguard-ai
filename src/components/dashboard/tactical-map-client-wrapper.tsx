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
  scanTargets?: LiveWorldMapProps["scanTargets"] | null;
  scanTargetById?: Record<string, string> | null;
  dense?: boolean;
  /** @deprecated No fake attack pulses — use LiveCommandMapClient for fortress telemetry */
  attackPulses?: boolean;
  /** @deprecated Use scanTargets only */
  activeScans?: number | null;
  /** @deprecated Removed — geo derived from target_url only */
  pulseNodeIds?: null;
};

/**
 * Client-only boundary for TacticalWorldMap — safe to import from Server Components.
 */
export function TacticalMapClientWrapper({
  scanTargets = null,
  scanTargetById = null,
  dense = false,
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
        scanTargets={scanTargets ?? []}
        scanTargetById={scanTargetById ?? {}}
        dense={dense}
      />
    </React.Suspense>
  );
}
