"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Loader2 } from "lucide-react";
import { releaseKineticBountyPayout } from "./actions";

/**
 * Sovereign payout — calls release_kinetic_bounty RPC (escrow → hacker wallet).
 */
export function PayoutButton({ escrowId }: { escrowId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await releaseKineticBountyPayout(escrowId);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            const payoutUsd = result.payout ?? 0;
            const credits = result.credits ?? Math.round(payoutUsd);
            const fee = result.fee ?? 0;
            setMessage(
              `Released $${payoutUsd.toFixed(2)} to hacker wallet (+${credits} credits, fee $${fee.toFixed(2)})`,
            );
            router.refresh();
          })
        }
        className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-[#D1FF00]/35 bg-[#D1FF00]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <DollarSign size={11} />}
        Payout
      </button>
      {message && (
        <span className="font-mono text-[9px] text-zinc-500 max-w-[220px] text-right">
          {message}
        </span>
      )}
    </div>
  );
}
