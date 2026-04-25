"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * EventStream — a bounded live-feed for the Overview dashboard.
 * Seed events come from the server; the client rotates in additional
 * mock entries on a throttled interval so the panel feels "live" without
 * spamming renders.
 *
 * When real telemetry is wired through Supabase Realtime, swap the
 * `useMockPump` hook for a real subscription — the component contract
 * stays the same.
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

const rotation: Omit<StreamEvent, "id" | "at">[] = [
  { severity: "secure", title: "Probe blocked", meta: "PROBE-0414 · md_image_exfil" },
  { severity: "info", title: "Classifier updated", meta: "pii.classifier v1.14" },
  { severity: "secure", title: "Probe blocked", meta: "PROBE-0421 · tool_allowlist" },
  { severity: "threat", title: "Elevated anomaly score", meta: "endpoint=billing-agent" },
  { severity: "info", title: "Nightly ATLAS sweep complete", meta: "384/384 probes" },
];

export function EventStream() {
  const reduce = useReducedMotion();
  const [events, setEvents] = React.useState<StreamEvent[]>(seed);

  React.useEffect(() => {
    if (reduce) return;
    let idx = 0;
    const tick = setInterval(() => {
      const next = rotation[idx % rotation.length];
      idx += 1;
      setEvents((prev) => [
        { id: Math.random().toString(36).slice(2), at: Date.now(), ...next },
        ...prev,
      ].slice(0, 8));
    }, 6500);
    return () => clearInterval(tick);
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
