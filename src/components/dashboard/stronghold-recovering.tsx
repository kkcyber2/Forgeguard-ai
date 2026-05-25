"use client";

import * as React from "react";
import { ShieldAlert, Terminal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";

export function StrongholdRecovering({
  message = "A subsystem failed to load. Your session and navigation remain secure.",
  systemLog,
  reset,
}: {
  message?: string;
  /** Raw error text — visible to sovereign operator via System Log. */
  systemLog?: string;
  reset?: () => void;
}) {
  const [showLog, setShowLog] = React.useState(false);
  const [isSovereign, setIsSovereign] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setIsSovereign(isSovereignOperator(data.user?.email));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const logText =
    systemLog ??
    "No system log attached. Check browser console and Vercel function logs.";

  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[4px] border border-white/[0.08] bg-[#0A0A0A]/80 px-6 py-10 text-center"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-acid/30 bg-acid/[0.08]">
        <ShieldAlert size={22} className="text-acid" strokeWidth={1.5} />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-white">
          Stronghold Recovering
        </h2>
        <p className="font-mono text-[12px] leading-relaxed text-white/45">{message}</p>
      </div>

      {showLog && isSovereign && (
        <pre className="max-h-48 w-full max-w-lg overflow-auto rounded-[3px] border border-white/10 bg-black/60 p-3 text-left font-mono text-[10px] leading-relaxed text-amber-200/90 whitespace-pre-wrap break-all">
          {logText}
        </pre>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => (reset ? reset() : window.location.reload())}
          className="rounded-[3px] border border-acid/40 bg-acid/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-acid transition-colors hover:bg-acid/20"
        >
          Reload
        </button>
        {isSovereign && (
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            <Terminal size={12} strokeWidth={1.5} />
            {showLog ? "Hide system log" : "System log"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatErrorLog(error: Error & { digest?: string }): string {
  const lines = [
    `message: ${error.message}`,
    error.digest ? `digest: ${error.digest}` : null,
    error.stack ? `stack:\n${error.stack}` : null,
  ].filter(Boolean);
  return lines.join("\n\n");
}

export function strongholdLogFromError(error: Error & { digest?: string }): string {
  return formatErrorLog(error);
}
