"use client";

import * as React from "react";
import { Coins, Loader2 } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/plans";
import { createCheckoutInvoice } from "./crypto-actions";

/** Bazaar credit pack — wallet top-up via Sovereign Vault (not subscription). */
export function CreditPackCard({ showOperatorDebug = false }: { showOperatorDebug?: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pack = CREDIT_PACKS[0];

  async function buyCredits() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await createCheckoutInvoice({
        planName: pack.name,
        depositKind: "credit_pack",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.invoiceUrl;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-6 rounded-sm border border-lime-500/15 bg-[#0a0a0a]/80 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Coins size={14} className="text-lime-400/70" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Credit Pack · Bazaar
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{pack.name}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{pack.description}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-xl font-bold text-lime-400">${pack.priceUsd} crypto</span>
        <span className="font-mono text-[10px] text-zinc-600">→ {pack.credits} credits</span>
      </div>

      {error && (
        <p className="mt-3 rounded-sm border border-amber-400/30 bg-amber-400/5 px-3 py-2 font-mono text-[10px] text-amber-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={buyCredits}
        disabled={pending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-lime-500/30 bg-lime-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-lime-400 transition-colors hover:bg-lime-500/10 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Opening checkout…
          </>
        ) : (
          "Buy with Sovereign Vault"
        )}
      </button>
    </div>
  );
}
