"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * EventStream — bounded live-feed for the Overview dashboard.
 *
 * Seeds with a few static entries, then subscribes to Supabase Realtime
 * `scan_logs` INSERTs (RLS-scoped to the current user) and prepends each new
 * log as it lands. Falls back to the seed if Realtime can't connect.
 */

export type StreamEvent = {
  id: string;
  at: number; // epoch ms
  severity: "info" | "secure" | "threat";
  title: string;
  meta: string;
};

const seed: StreamEvent[] = [
  { id: "e1", at: Date.now() - 5_000, severity: "secure", title: "Probe blocked", meta: "PROBE-0412 · indirect_injection" },
  { id: "e2", at: Date.now() - 18_000, severity: "secure", title: "Probe blocked", meta: "PROBE-0413 · base64_override" },
  { id: "e3", at: Date.now() - 42_000, severity: "threat", title: "Policy breach flagged for audit", meta: "PROBE-0418 · role_swap" },
  { id: "e4", at: Date.now() - 61_000, severity: "info", title: "Guardrail build deployed", meta: "policy@e9c2f1 · envs=prod,staging" },
  { id: "e5", at: Date.now() - 90_000, severity: "secure", title: "New endpoint enrolled", meta: "support-agent.prod" },
];

interface ScanLogRow {
  id?: string;
  scan_id?: string;
  type?: string;
  severity?: string;
  attack_name?: string;
  payload?: { message?: string } | null;
  created_at?: string;
}

function severityOf(type: string | undefined, sev: string | undefined): StreamEvent["severity"] {
  const t = (type ?? "").toLowerCase();
  const s = (sev ?? "").toLowerCase();
  if (["breach", "strike", "finding"].includes(t) || ["critical", "high"].includes(s)) return "threat";
  if (t === "info" || s === "info") return "info";
  return "secure";
}

function rowToEvent(row: ScanLogRow): StreamEvent {
  const payload = (row.payload ?? {}) as { message?: string };
  const title = (row.attack_name || payload.message || "Scan event").slice(0, 80);
  const scanTag = row.scan_id ? row.scan_id.slice(0, 8) : "—";
  const meta = `${scanTag} · ${row.type ?? "log"}`;
  const at = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  return {
    id: row.id ?? Math.random().toString(36).slice(2),
    at,
    severity: severityOf(row.type, row.severity),
    title,
    meta,
  };
}

export function EventStream() {
  const reduce = useReducedMotion();
  const [events, setEvents] = React.useState<StreamEvent[]>(seed);

  React.useEffect(() => {
    if (reduce) return;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("dashboard:event-stream:scan_logs")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "scan_logs" },
          (payload) => {
            const row = payload.new as ScanLogRow;
            setEvents((prev) => [rowToEvent(row), ...prev].slice(0, 12));
          },
        )
        .subscribe();
    } catch (err) {
      console.warn("[event-stream] Realtime subscribe failed, using seed:", err);
    }
    return () => {
      if (channel) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (channel as any).unsubscribe?.();
        } catch {
          /* best-effort */
        }
      }
    };
  }, [reduce]);

  return (
    <ul className="divide-y divide-white/[0.04]">
      <AnimatePresence initial={false}>
        {events.map((ev) => (
          <motion.li
            key={ev.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="flex items-center gap-4 px-5 py-3"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                ev.severity === "secure"
                  ? "bg-acid animate-pulse-acid"
                  : ev.severity === "threat"
                  ? "bg-threat animate-pulse-threat"
                  : "bg-foreground-subtle",
              )}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm",
                  ev.severity === "threat" ? "text-threat" : "text-foreground",
                )}
              >
                {ev.title}
              </p>
              <p className="truncate font-mono text-[11px] text-foreground-subtle">
                {ev.meta}
              </p>
            </div>
            <time
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
              dateTime={new Date(ev.at).toISOString()}
            >
              {relative(ev.at)}
            </time>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function relative(at: number) {
  const delta = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}
