"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldAlert, ShieldCheck, Zap, Filter } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

/**
 * RedTeamFeed — live audit log for the User Dashboard.
 * ----------------------------------------------------
 * Client component because (a) it filters interactively and (b) we
 * subscribe to Supabase Realtime in a later patch via the same
 * `useRedTeamStream` extension point. Until then, server-rendered
 * `seed` events pre-populate it so SSR is meaningful.
 */

export type RedTeamLog = {
  id: string;
  at: string; // ISO
  technique: string;
  payload: string;
  outcome: "blocked" | "leaked" | "audit";
  severity: "info" | "low" | "medium" | "high" | "critical";
  scanId?: string;
};

const FILTERS = ["all", "blocked", "leaked", "audit"] as const;
type Filter = (typeof FILTERS)[number];

const OUTCOME_META: Record<
  RedTeamLog["outcome"],
  { label: string; tone: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }
> = {
  blocked: { label: "Blocked", tone: "text-acid", Icon: ShieldCheck },
  leaked: { label: "Leaked", tone: "text-threat", Icon: ShieldAlert },
  audit: { label: "Audit", tone: "text-amber-300", Icon: Zap },
};

const SEV_BADGE: Record<RedTeamLog["severity"], string> = {
  critical: "bg-threat/15 text-threat border-threat/40",
  high: "bg-threat/10 text-threat-soft border-threat/25",
  medium: "bg-amber-500/10 text-amber-300 border-amber-400/30",
  low: "bg-acid-wash text-acid border-acid/25",
  info: "bg-white/5 text-foreground-muted border-white/10",
};

export function RedTeamFeed({ seed }: { seed: RedTeamLog[] }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [logs] = React.useState<RedTeamLog[]>(seed);

  const visible = React.useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.outcome === filter)),
    [logs, filter],
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-5 pb-3">
        <Filter size={12} strokeWidth={1.5} className="text-foreground-subtle" />
        <div role="tablist" className="flex items-center gap-1">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-6 rounded-xs border-hairline px-2 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border-acid/40 bg-acid-wash text-acid"
                    : "border-white/[0.08] text-foreground-subtle hover:border-white/20 hover:text-foreground",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
          {visible.length} {visible.length === 1 ? "event" : "events"}
        </span>
      </div>

      <ul className="border-t-[0.5px] border-white/[0.05] divide-y divide-white/[0.04]">
        <AnimatePresence initial={false}>
          {visible.length === 0 ? (
            <li className="px-5 py-10 text-center text-xs text-foreground-subtle">
              No {filter === "all" ? "" : `${filter} `}events in window.
            </li>
          ) : (
            visible.map((log) => {
              const meta = OUTCOME_META[log.outcome];
              const Icon = meta.Icon;
              return (
                <motion.li
                  key={log.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                  className="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-3"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 items-center justify-center rounded-xs border-hairline",
                      log.outcome === "blocked" && "border-acid/25 bg-acid-wash",
                      log.outcome === "leaked" && "border-threat/30 bg-threat-wash",
                      log.outcome === "audit" && "border-amber-400/25 bg-amber-500/10",
                    )}
                  >
                    <Icon size={11} strokeWidth={1.5} className={meta.tone} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-sm", log.outcome === "leaked" ? "text-threat" : "text-foreground")}>
                        {log.technique}
                      </span>
                      <span
                        className={cn(
                          "inline-flex h-4 items-center rounded-xs border-hairline px-1.5 text-[9px] font-medium uppercase tracking-[0.14em]",
                          SEV_BADGE[log.severity],
                        )}
                      >
                        {log.severity}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-foreground-subtle">
                      <span className="text-foreground-muted">payload:</span>{" "}
                      {log.payload}
                    </p>
                  </div>

                  <time
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
                    dateTime={log.at}
                  >
                    {formatRelativeTime(log.at)}
                  </time>
                </motion.li>
              );
            })
          )}
        </AnimatePresence>
      </ul>
    </div>
  );
}
