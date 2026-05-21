"use client";

import { useTransition } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { releaseBountyFunds } from "./actions";

export function ReleaseFundsButton({ escrowId }: { escrowId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void releaseBountyFunds(escrowId))}
      className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-[#D1FF00]/35 bg-[#D1FF00]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
    >
      {pending ? <Loader2 size={11} className="animate-spin" /> : <DollarSign size={11} />}
      Release funds
    </button>
  );
}
