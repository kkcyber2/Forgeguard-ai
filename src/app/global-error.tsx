"use client";

import { useEffect } from "react";
import { StrongholdRecovering, strongholdLogFromError } from "@/components/dashboard/stronghold-recovering";
import { ThemeScript } from "@/components/theme/theme-script";

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
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
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
