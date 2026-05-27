"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

/**
 * ScanStatusTracker
 * -----------------
 * Client component that keeps the scan status badge + progress bar live.
 *
 * Two-pronged approach so we never miss an update:
 *
 *  1. On mount: immediately fetch the current row from Supabase so the
 *     display reflects reality even if the Realtime WebSocket wasn't
 *     connected while the scan was running (the "stuck at 1%" bug).
 *
 *  2. Subscribe to `postgres_changes` UPDATE events on the `scans` table
 *     filtered to this scan ID — incoming events update local state in
 *     real time for in-progress scans.
 */

const STATUS_TONE = {
  queued: "warn",
  probing: "live",
  triage: "warn",
  sealed: "secure",
  failed: "threat",
} as const;

const STATUS_LABEL = {
  queued: "Queued",
  probing: "Probing",
  triage: "Triage",
  sealed: "Sealed",
  failed: "Failed",
} as const;

type ScanStatus = keyof typeof STATUS_TONE;

function isScanStatus(s: unknown): s is ScanStatus {
  return typeof s === "string" && s in STATUS_TONE;
}

interface Props {
  scanId: string;
  initialStatus: ScanStatus;
  initialProgress: number;
}

export function ScanStatusTracker({
  scanId,
  initialStatus,
  initialProgress,
}: Props) {
  const [status, setStatus] = React.useState<ScanStatus>(initialStatus);
  const [progress, setProgress] = React.useState<number>(initialProgress);
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  );
  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    supabase
      .from("scans")
      .select("status, progress_pct")
      .eq("id", scanId)
      .single()
      .then(({ data }) => {
        if (!data || cancelled) return;
        if (isScanStatus(data.status)) setStatus(data.status);
        setProgress(data.progress_pct ?? 0);
      });

    const subscribe = () => {
      if (cancelled) return null;
      const channelName = `status:${scanId}:${sessionIdRef.current}`;
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "scans",
            filter: `id=eq.${scanId}`,
          },
          (payload) => {
            const row = payload.new as {
              status: unknown;
              progress_pct: number | null;
            };
            if (isScanStatus(row.status)) setStatus(row.status);
            setProgress(row.progress_pct ?? 0);
          },
        )
        .subscribe((st) => {
          if (st === "CHANNEL_ERROR" && !cancelled) {
            void supabase.removeChannel(channel);
            channelRef.current = null;
            retryTimer = setTimeout(subscribe, 3000);
          }
        });
      channelRef.current = channel;
      return channel;
    };

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        void supabase.removeChannel(ch);
      }
    };
  }, [scanId]);

  const tone = STATUS_TONE[status];
  const isActive = status === "probing" || status === "queued";

  return (
    <>
      <div className="flex items-center justify-between">
        <Badge tone={tone} dot={isActive}>
          {STATUS_LABEL[status]}
        </Badge>
        <span className="font-mono text-xs text-foreground-muted">
          {progress}%
        </span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={
            isActive
              ? "h-full rounded-full bg-gradient-to-r from-acid/40 via-acid to-acid/40 bg-[length:200%_100%] animate-shimmer"
              : tone === "secure"
              ? "h-full rounded-full bg-acid"
              : tone === "threat"
              ? "h-full rounded-full bg-threat"
              : "h-full rounded-full bg-foreground-muted"
          }
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  );
}
