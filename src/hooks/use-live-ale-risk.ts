"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export function useLiveAleRisk(userId: string | null, initialTotal: number) {
  const [total, setTotal] = React.useState(initialTotal);
  const [pulseKey, setPulseKey] = React.useState(0);
  const supabase = React.useMemo(() => createClient(), []);

  const bumpPulse = React.useCallback(() => {
    setPulseKey((k) => k + 1);
  }, []);

  const refetchTotal = React.useCallback(async () => {
    if (!userId) return;
    const { data: scans } = await supabase
      .from("scans")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "sealed");
    const scanIds = (scans ?? []).map((s) => s.id);
    if (scanIds.length === 0) {
      setTotal(0);
      return;
    }
    const { data: reports } = await supabase
      .from("scan_reports")
      .select("financial_liability_usd")
      .in("scan_id", scanIds);
    const sum = (reports ?? []).reduce(
      (acc, row) => acc + Number(row.financial_liability_usd ?? 0),
      0,
    );
    setTotal(sum);
    bumpPulse();
  }, [supabase, userId, bumpPulse]);

  React.useEffect(() => {
    setTotal(initialTotal);
  }, [initialTotal]);

  React.useEffect(() => {
    if (!userId) return;

    let userScanIds = new Set<string>();
    let cancelled = false;

    void supabase
      .from("scans")
      .select("id")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        userScanIds = new Set((data ?? []).map((s) => s.id));
      });

    const channel = supabase
      .channel(`ale-risk:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scans",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as { progress_pct?: number; id?: string };
          if (next.id) userScanIds.add(next.id);
          if (typeof next.progress_pct === "number") {
            void refetchTotal();
          } else {
            bumpPulse();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scan_reports",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { scan_id?: string } | undefined;
          if (row?.scan_id && userScanIds.has(row.scan_id)) {
            void refetchTotal();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refetchTotal, bumpPulse]);

  return { total, pulseKey };
}
