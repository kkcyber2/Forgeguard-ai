"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet-events";

export interface LiveWalletState {
  balance_usd: number;
  is_frozen: boolean;
  loading: boolean;
}

type WalletChannelEntry = {
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>;
  refCount: number;
};

const walletChannels = new Map<string, WalletChannelEntry>();

function acquireWalletChannel(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  onChange: () => void,
): WalletChannelEntry {
  const existing = walletChannels.get(userId);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }

  const channel = supabase
    .channel(`wallet:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_wallets",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("[wallet:realtime] channel error for user", userId);
      }
    });

  const entry: WalletChannelEntry = { channel, refCount: 1 };
  walletChannels.set(userId, entry);
  return entry;
}

function releaseWalletChannel(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): void {
  const entry = walletChannels.get(userId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    void supabase.removeChannel(entry.channel);
    walletChannels.delete(userId);
  }
}

export function useLiveWallet(initialBalance = 0): LiveWalletState {
  const [wallet, setWallet] = React.useState<LiveWalletState>({
    balance_usd: initialBalance,
    is_frozen: false,
    loading: true,
  });
  const [userId, setUserId] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const fetchWalletRef = React.useRef<(() => Promise<string | null>) | null>(
    null,
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

  fetchWalletRef.current = fetchWallet;

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
      void fetchWalletRef.current?.();
    };

    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    void fetchWalletRef.current?.();
    const interval = setInterval(() => void fetchWalletRef.current?.(), 15_000);

    return () => {
      window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (!userId) return;

    const onChange = () => {
      void fetchWalletRef.current?.();
    };
    acquireWalletChannel(supabase, userId, onChange);

    return () => {
      releaseWalletChannel(supabase, userId);
    };
  }, [supabase, userId]);

  return wallet;
}
