"use client";

import { useEffect } from "react";
import { StrongholdRecovering } from "@/components/dashboard/stronghold-recovering";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard:error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <StrongholdRecovering
      message="Dashboard telemetry could not load. Top navigation remains active — reload to retry."
      reset={reset}
    />
  );
}
