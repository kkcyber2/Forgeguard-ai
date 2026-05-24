"use client";

import Link from "next/link";
import { Lock, X, Zap } from "lucide-react";

export function UpgradeRequiredModal({
  feature = "The Forge",
  requiredRank = "Ghost (Startup+)",
  onClose,
}: {
  feature?: string;
  requiredRank?: string;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-[6px] border-[0.5px] border-violet-400/30 bg-[#090909] p-6 shadow-2xl">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-white/40 hover:text-white/70"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[4px] border border-violet-400/30 bg-violet-400/10">
          <Lock size={22} className="text-violet-400" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-400">
          Upgrade Required
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{feature} Locked</h2>
        <p className="mt-2 text-sm text-white/60">
          Stronghold v3.0 gates adversarial execution behind{" "}
          <span className="font-mono text-violet-300">{requiredRank}</span> clearance.
          Upgrade your subscription to unlock the Terminal, Elite modules, and live mutation engine.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard/billing"
            className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-violet-500 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-white"
          >
            <Zap size={14} />
            Upgrade Plan
          </Link>
          <Link
            href="/dashboard/settings#clearance"
            className="flex flex-1 items-center justify-center rounded-[3px] border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-white/70"
          >
            Verification Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
