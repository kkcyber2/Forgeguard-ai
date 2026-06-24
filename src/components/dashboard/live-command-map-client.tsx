"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { LiveMapBootstrap } from "@/lib/live-map/platform-events";
import type { ScanTargetPulse } from "@/components/dashboard/tactical-world-map";
import { TacticalWorldMapSkeleton } from "@/components/dashboard/tactical-world-map-skeleton";

const LiveCommandMapLazy = dynamic(
  () =>
    import("@/components/dashboard/live-command-map").then(
      (m) => m.LiveCommandMap,
    ),
  { ssr: false },
);

export interface LiveCommandMapClientProps {
  bootstrap: LiveMapBootstrap;
  scanTargets?: ScanTargetPulse[] | null;
  dense?: boolean;
  showPerimeter?: boolean;
}

export function LiveCommandMapClient({
  bootstrap,
  scanTargets = null,
  dense = false,
  showPerimeter = true,
}: LiveCommandMapClientProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <TacticalWorldMapSkeleton dense={dense} />;
  }

  return (
    <React.Suspense fallback={<TacticalWorldMapSkeleton dense={dense} />}>
      <LiveCommandMapLazy
        bootstrap={bootstrap}
        scanTargets={scanTargets ?? []}
        dense={dense}
        showPerimeter={showPerimeter}
      />
    </React.Suspense>
  );
}
