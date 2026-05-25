"use client";

import { ShieldAlert } from "lucide-react";

export function StrongholdRecovering({
  message = "A subsystem failed to load. Your session and navigation remain secure.",
  reset,
}: {
  message?: string;
  reset?: () => void;
}) {
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
      <button
        type="button"
        onClick={() => (reset ? reset() : window.location.reload())}
        className="mt-2 rounded-[3px] border border-acid/40 bg-acid/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-acid transition-colors hover:bg-acid/20"
      >
        Reload
      </button>
    </div>
  );
}
