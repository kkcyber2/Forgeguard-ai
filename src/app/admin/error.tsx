"use client";

import { useEffect } from "react";
import { StrongholdRecovering, strongholdLogFromError } from "@/components/dashboard/stronghold-recovering";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin:error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <StrongholdRecovering
      message="Admin command center fault — reload to restore sovereign control."
      systemLog={strongholdLogFromError(error)}
      digest={error.digest}
      reset={reset}
    />
  );
}
