"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Info,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * ScanLiveLog — subscribes to Postgres Realtime for new `scan_logs`
 * rows scoped to a single scan, then prepends them into the visible
 * feed. The initial slice is rendered server-side so the page is useful
 * before the websocket is even connected.
 *
 * RLS still applies to the broadcast — Supabase will silently drop
 * payloads the user isn't allowed to see, so we never need a defensive
 * filter on the client.
 */

export type ScanLogEntry = {
  id: number;
  type: "progress" | "finding" | "attempt" | "audit" | "error" | "info";
  severity: "info" | "low" | "medium" | "high" | "critical";
  attack_name: string | null;
  payload: unknown;
  created_at: string;
};

interface Props {
  scanId: string;
  initial: ScanLogEntry[];
  createdAt: string;
}

const SEVERITY_TONE: Record<ScanLogEntry["severity"], string> = {
  critical: "text-threat",
  high: "text-threat",
  medium: "text-amber-300",
  low: "text-acid",
  info: "text-foreground-muted",
};

const SEVERITY_DOT: Record<ScanLogEntry["severity"], string> = {
  critical: "bg-threat animate-pulse-threat",
  high: "bg-threat",
  medium: "bg-amber-400",
  low: "bg-acid",
  info: "bg-foreground-subtle",
};

const TYPE_ICON: Record<
  ScanLogEntry["type"],
  React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
> = {
  progress: Zap,
  finding: ShieldAlert,
  attempt: ChevronRight,
  audit: CheckCircle2,
  error: AlertOctagon,
  info: Info,
};

export function ScanLiveLog({ scanId, initial, createdAt }: Props) {
  const reduce = useReducedMotion();
  const [entries, setEntries] = React.useState<ScanLogEntry[]>(initial);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`scan_logs:${scanId}`)
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
          setEntries((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            return [row, ...prev].slice(0, 200);
          });
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scanId]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-sm border-hairline border-white/[0.04] bg-obsidian-900/30 px-6 py-10 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border-hairline border-white/[0.08] bg-obsidian-800/60">
          <Zap size={14} strokeWidth={1.5} className="text-foreground-subtle" />
        </div>
        <p className="text-sm font-medium text-foreground">Awaiting first probe…</p>
        <p className="max-w-sm text-xs text-foreground-muted">
          The runner is warming up. Findings will stream into this view in
          real time as soon as the first probe lands.
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          Channel {connected ? "live" : "connecting…"} · queued at{" "}
          {new Date(createdAt).toLocaleTimeString()}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            connected ? "bg-acid animate-pulse-acid" : "bg-foreground-subtle",
          )}
        />
        {connected ? "Live channel attached" : "Reconnecting…"}
      </div>
      <ul className="max-h-[460px] divide-y divide-white/[0.04] overflow-y-auto rounded-sm border-hairline border-white/[0.04] bg-obsidian-900/30">
        <AnimatePresence initial={false}>
          {entries.map((ev) => {
            const Icon = TYPE_ICON[ev.type];
            return (
              <motion.li
                key={ev.id}
                layout
                initial={reduce ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                className="flex items-start gap-3 px-4 py-3"
              >
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[ev.severity])} />
                <Icon
                  size={12}
                  strokeWidth={1.75}
                  className={cn("mt-1 shrink-0", SEVERITY_TONE[ev.severity])}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", SEVERITY_TONE[ev.severity])}>
                    {ev.attack_name ?? formatType(ev.type)}
                  </p>
                  <p className="truncate font-mono text-[11px] text-foreground-subtle">
                    {summarize(ev.payload)}
                  </p>
                </div>
                <time
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
                  dateTime={ev.created_at}
                >
                  {new Date(ev.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </time>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function formatType(t: ScanLogEntry["type"]): string {
  switch (t) {
    case "progress":
      return "Progress update";
    case "finding":
      return "Finding";
    case "attempt":
      return "Probe attempted";
    case "audit":
      return "Audit checkpoint";
    case "error":
      return "Runner error";
    default:
      return "Info";
  }
}

function summarize(payload: unknown): string {
  if (payload == null) return "—";
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return String(payload);
  const p = payload as Record<string, unknown>;
  // Common shapes from the Python runner.
  if (typeof p.message === "string") return p.message;
  if (typeof p.summary === "string") return p.summary;
  if (typeof p.attack === "string") return p.attack;
  if (typeof p.probe === "string") return p.probe;
  if (Array.isArray(p.tags)) return (p.tags as string[]).join(" · ");
  try {
    return JSON.stringify(p).slice(0, 160);
  } catch {
    return "[unserializable]";
  }
}
