"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SeverityMeter,
  type SeverityCounts,
} from "@/components/dashboard/severity-meter";
import type { ScanLogEntry } from "./live-log";

function normalizeSeverity(raw: string): keyof SeverityCounts {
  const s = (raw || "info").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  return "info";
}

function payloadSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.success === true) return true;
  if (p.verdict === true) return true;
  return false;
}

export function aggregateSeverityFromLogs(rows: ScanLogEntry[]): SeverityCounts {
  const out: SeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const r of rows) {
    const sev = normalizeSeverity(r.severity);
    if (r.type === "finding" || r.type === "breach") {
      out[sev] = (out[sev] ?? 0) + 1;
      continue;
    }
    if (
      (r.type === "attempt" || r.type === "strike") &&
      (sev === "high" || sev === "critical") &&
      payloadSuccess(r.payload)
    ) {
      out[sev] = (out[sev] ?? 0) + 1;
    }
  }
  return out;
}

function totalFromCounts(counts: SeverityCounts): number {
  return (
    (counts.critical ?? 0) +
    (counts.high ?? 0) +
    (counts.medium ?? 0) +
    (counts.low ?? 0) +
    (counts.info ?? 0)
  );
}

export function FindingsBreakdown({
  scanId,
  initialLogs,
  fallbackCount,
}: {
  scanId: string;
  initialLogs: ScanLogEntry[];
  fallbackCount: number | null;
}) {
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  );
  const [logs, setLogs] = React.useState<ScanLogEntry[]>(initialLogs);

  React.useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  React.useEffect(() => {
    const supabase = createClient();
    const channelName = `scan_findings:${scanId}:${sessionIdRef.current}`;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = () => {
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "scan_logs",
            filter: `scan_id=eq.${scanId}`,
          },
          (payload) => {
            const row = payload.new as ScanLogEntry;
            setLogs((prev) => {
              if (prev.some((e) => e.id === row.id)) return prev;
              return [row, ...prev].slice(0, 200);
            });
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            void supabase.removeChannel(channel);
            retryTimer = setTimeout(subscribe, 3000);
          }
        });

      return channel;
    };

    const channel = subscribe();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      void supabase.removeChannel(channel);
    };
  }, [scanId]);

  const counts = aggregateSeverityFromLogs(logs);
  const liveTotal = totalFromCounts(counts);
  const displayTotal = liveTotal > 0 ? liveTotal : (fallbackCount ?? 0);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert size={12} strokeWidth={1.75} className="text-foreground-subtle" />
        <span className="text-eyebrow text-foreground-subtle">Findings breakdown</span>
      </div>
      <p className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
        {displayTotal}
        <span className="ml-1.5 text-xs font-normal text-foreground-subtle">total</span>
      </p>
      <SeverityMeter counts={counts} showLegend />
    </>
  );
}
