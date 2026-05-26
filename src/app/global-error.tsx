"use client";

import { useEffect } from "react";
import { StrongholdRecovering, strongholdLogFromError } from "@/components/dashboard/stronghold-recovering";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global:error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <html lang="en" className="dark font-sans">
      <body className="min-h-screen bg-[#050505] text-white antialiased">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6">
          <StrongholdRecovering
            message="A critical subsystem fault was detected. Reload to re-establish the Stronghold link."
            systemLog={strongholdLogFromError(error)}
            digest={error.digest}
            reset={reset}
          />
        </div>
      </body>
    </html>
  );
}
