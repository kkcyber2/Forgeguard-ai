"use client";

/**
 * WalletCredits
 * ─────────────────────────────────────────────────────────────────────────────
 * Client component that displays the current user's wallet balance in the
 * sidebar. Fetches from user_wallets via the browser Supabase client and
 * polls every 30s so top-ups reflect without a full page reload.
 *
 * Shows a locked state when is_frozen = true.
 */

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Coins, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletState {
  balance_usd: number;
  is_frozen:   boolean;
  loading:     boolean;
}

export function WalletCredits() {
  const [wallet, setWallet] = React.useState<WalletState>({
    balance_usd: 0,
    is_frozen:   false,
    loading:     true,
  });

  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const fetchWallet = React.useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWallet((w) => ({ ...w, loading: false })); return; }

    const { data } = await supabase
      .from("user_wallets")
      .select("balance_usd, is_frozen")
      .eq("user_id", user.id)
      .maybeSingle();

    setWallet({
      balance_usd: (data?.balance_usd as number | null) ?? 0,
      is_frozen:   (data?.is_frozen as boolean | null) ?? false,
      loading:     false,
    });
  }, [supabase]);

  React.useEffect(() => {
    void fetchWallet();
    const interval = setInterval(() => void fetchWallet(), 30_000);
    return () => clearInterval(interval);
  }, [fetchWallet]);

  if (wallet.loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1">
        <div className="h-3 w-12 animate-pulse rounded-none bg-white/[0.05]" />
      </div>
    );
  }

  if (wallet.is_frozen) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-sm px-3 py-1"
        title="Account restricted — contact support"
      >
        <Lock size={10} strokeWidth={1.5} className="shrink-0 text-red-500/70" />
        <span className="font-mono text-[10px] text-red-500/70 uppercase tracking-widest">
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
      )}
      title={`Wallet balance: $${wallet.balance_usd.toFixed(2)}`}
    >
      <Coins size={10} strokeWidth={1.5} className="shrink-0 text-acid" />
      <span className="font-mono text-[10px] font-semibold text-acid">
        ${wallet.balance_usd.toFixed(2)}
      </span>
    </div>
  );
}
