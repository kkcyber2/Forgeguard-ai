"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { StrongholdRecovering, strongholdLogFromError } from "@/components/dashboard/stronghold-recovering";

function messageForPath(pathname: string): string {
  if (pathname.startsWith("/dashboard/settings")) {
    return "Settings could not load — profile and verification forms are temporarily unavailable.";
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/scans")) {
    return "Overview telemetry unavailable. Top navigation remains active — reload to retry.";
  }
  if (pathname.startsWith("/dashboard/billing")) {
    return "Billing could not load. Top navigation remains active — reload to retry.";
  }
  return "This dashboard section could not load. Top navigation remains active — reload to retry.";
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "/dashboard";

  useEffect(() => {
    console.error("[dashboard:error]", pathname, error.digest ?? error.message, error);
  }, [error, pathname]);

  return (
    <StrongholdRecovering
      message={messageForPath(pathname)}
      systemLog={strongholdLogFromError(error)}
      digest={error.digest}
      reset={reset}
    />
  );
}
