"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet-events";

export interface LiveWalletState {
  balance_usd: number;
  is_frozen: boolean;
  loading: boolean;
}

export function useLiveWallet(initialBalance = 0): LiveWalletState {
  const [wallet, setWallet] = React.useState<LiveWalletState>({
    balance_usd: initialBalance,
    is_frozen: false,
    loading: true,
  });

  const supabase = React.useMemo(() => createClient(), []);

  const fetchWallet = React.useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setWallet((w) => ({ ...w, loading: false }));
      return;
    }

    const { data } = await supabase
      .from("user_wallets")
      .select("balance_usd, is_frozen")
      .eq("user_id", user.id)
      .maybeSingle();

    setWallet({
      balance_usd: Number(data?.balance_usd ?? 0),
      is_frozen: data?.is_frozen ?? false,
      loading: false,
    });
  }, [supabase]);

  React.useEffect(() => {
    void fetchWallet();

    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ balance?: number }>).detail;
      if (typeof detail?.balance === "number") {
        setWallet((w) => ({ ...w, balance_usd: detail.balance!, loading: false }));
        return;
      }
      void fetchWallet();
    };

    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    const interval = setInterval(() => void fetchWallet(), 5_000);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel(`wallet:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_wallets",
            filter: `user_id=eq.${user.id}`,
          },
          () => void fetchWallet(),
        )
        .subscribe();
    });

    return () => {
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchWallet, supabase]);

  return wallet;
}
