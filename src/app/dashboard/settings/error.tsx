"use client";

import { useEffect } from "react";
import { StrongholdRecovering, strongholdLogFromError } from "@/components/dashboard/stronghold-recovering";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[settings:error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <StrongholdRecovering
      message="Settings could not load — profile and verification forms are temporarily unavailable."
      systemLog={strongholdLogFromError(error)}
      reset={reset}
    />
  );
}
