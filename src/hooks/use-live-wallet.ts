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
  const [userId, setUserId] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  );

  const fetchWallet = React.useCallback(async (): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setWallet((w) => ({ ...w, loading: false }));
      setUserId(null);
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
    setUserId(user.id);
    return user.id;
  }, [supabase]);

  // Poll + manual refresh events
  React.useEffect(() => {
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ balance?: number }>).detail;
      if (typeof detail?.balance === "number") {
        setWallet((w) => ({
          ...w,
          balance_usd: detail.balance!,
          loading: false,
        }));
        return;
      }
      void fetchWallet();
    };

    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    void fetchWallet();
    const interval = setInterval(() => void fetchWallet(), 5_000);

    return () => {
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      clearInterval(interval);
    };
  }, [fetchWallet]);

  // Realtime — register .on() before .subscribe(); cleanup removes channel
  React.useEffect(() => {
    if (!userId) return;

    const channelName = `wallet:${userId}:${sessionIdRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_wallets",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchWallet();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[wallet:realtime] Sovereign Realtime Active");
        }
        if (status === "CHANNEL_ERROR") {
          console.error("[wallet:realtime] channel error for user", userId);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchWallet, supabase, userId]);

  return wallet;
}
