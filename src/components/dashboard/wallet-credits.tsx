"use client";

import * as React from "react";
import { Coins, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveWallet, type LiveWalletState } from "@/hooks/use-live-wallet";

interface WalletCreditsProps {
  initialBalance?: number;
  className?: string;
  /** When provided, skips an internal Realtime subscription (TopBar owns one shared hook). */
  wallet?: LiveWalletState;
}

function WalletCreditsInner({
  wallet,
  className,
}: {
  wallet: LiveWalletState;
  className?: string;
}) {
  if (wallet.loading) {
    return (
      <div className={cn("flex items-center gap-1.5 px-3 py-1", className)}>
        <div className="h-3 w-12 animate-pulse rounded-none bg-white/[0.05]" />
      </div>
    );
  }

  if (wallet.is_frozen) {
    return (
      <div
        className={cn("flex items-center gap-1.5 rounded-sm px-3 py-1", className)}
        title="Account restricted — contact support"
      >
        <Lock size={10} strokeWidth={1.5} className="shrink-0 text-red-500/70" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-red-500/70">
          Restricted
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-3 py-1",
        "border-[0.5px] border-acid/20 bg-acid/[0.04]",
        className,
      )}
      title={`Wallet balance: $${wallet.balance_usd.toFixed(2)}`}
    >
      <Coins size={10} strokeWidth={1.5} className="shrink-0 text-acid" />
      <span className="font-mono text-[10px] font-semibold tabular-nums text-acid">
        ${wallet.balance_usd.toFixed(2)}
      </span>
    </div>
  );
}

function WalletCreditsConnected({
  initialBalance = 0,
  className,
}: {
  initialBalance: number;
  className?: string;
}) {
  const wallet = useLiveWallet(initialBalance);
  return <WalletCreditsInner wallet={wallet} className={className} />;
}

export function WalletCredits({
  initialBalance = 0,
  className,
  wallet,
}: WalletCreditsProps) {
  if (wallet) {
    return <WalletCreditsInner wallet={wallet} className={className} />;
  }

  return (
    <WalletCreditsConnected initialBalance={initialBalance} className={className} />
  );
}
