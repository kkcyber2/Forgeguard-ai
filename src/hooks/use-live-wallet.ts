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
      return null;
    }

    const { data, error } = await supabase
      .from("user_wallets")
      .select("balance_usd, is_frozen")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[wallet:fetch]", error.message);
    }

    setWallet({
      balance_usd: Number(data?.balance_usd ?? 0),
      is_frozen: data?.is_frozen ?? false,
      loading: false,
    });

    return user.id;
  }, [supabase]);

  React.useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

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

    void (async () => {
      const uid = await fetchWallet();
      if (cancelled || !uid) return;

      channel = supabase
        .channel(`wallet:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_wallets",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            if (!cancelled) void fetchWallet();
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.error("[wallet:realtime] channel error for user", uid);
          }
        });
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      clearInterval(interval);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [fetchWallet, supabase]);

  return wallet;
}
