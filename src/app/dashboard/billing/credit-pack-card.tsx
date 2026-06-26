"use client";

import * as React from "react";
import { Coins } from "lucide-react";
import { CREDIT_PACKS, type PlanMeta } from "@/lib/plans";
import { SovereignVaultModal } from "./sovereign-vault-modal";

/** Bazaar credit pack — wallet top-up via Sovereign Vault (not subscription). */
export function CreditPackCard({ showOperatorDebug = false }: { showOperatorDebug?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const pack = CREDIT_PACKS[0];

  const planMeta: PlanMeta = {
    id: "startup",
    name: pack.name,
    price: pack.priceUsd,
    scansPerMonth: 0,
    engine: "Bazaar Wallet",
    pdfReport: false,
    apiAccess: false,
    description: pack.description,
    features: [`${pack.credits} Bazaar credits`, "Script purchases", "Mission escrow"],
  };

  return (
    <>
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
          <span className="text-xl font-bold text-lime-400">${pack.priceUsd} USDT</span>
          <span className="font-mono text-[10px] text-zinc-600">→ {pack.credits} credits</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-sm border border-lime-500/30 bg-lime-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-lime-400 transition-colors hover:bg-lime-500/10"
        >
          Open Sovereign Vault
        </button>
      </div>

      {open && (
        <SovereignVaultModal
          open
          plan={planMeta}
          depositKind="credit_pack"
          showOperatorDebug={showOperatorDebug}
          onClose={() => setOpen(false)}
          onConfirmed={() => {
            setOpen(false);
            window.location.href = "/dashboard/bazaar?credits=1";
          }}
        />
      )}
    </>
  );
}
