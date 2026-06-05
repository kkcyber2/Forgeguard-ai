import * as React from "react";
import Script from "next/script";
import { Suspense } from "react";
import { BunkerChallengeClient } from "./bunker-challenge-client";

export default function BunkerChallengePage() {
  return (
    <>
      <Script src="/aegis-trap.js" strategy="afterInteractive" />
      <Suspense
        fallback={
          <div className="flex min-h-[70vh] items-center justify-center font-mono text-[11px] text-foreground-muted">
            Initializing bunker challenge…
          </div>
        }
      >
        <BunkerChallengeClient />
      </Suspense>
    </>
  );
}
