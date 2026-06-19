"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Pause, Play, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReplayStep } from "@/lib/evolve/replay-steps";

const PHASE_COLOR: Record<ReplayStep["phase"], string> = {
  recon: "border-steel-600 text-foreground-muted",
  strike: "border-amber-500/40 text-amber-300",
  breach: "border-threat/50 text-threat",
  thought: "border-purple-500/40 text-purple-300",
  report: "border-acid/40 text-acid",
};

export function AttackReplayTheater({ steps }: { steps: ReplayStep[] }) {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!playing || steps.length === 0) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1 >= steps.length ? 0 : i + 1));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  if (steps.length === 0) return null;

  const current = steps[index] ?? steps[0]!;

  return (
    <div className="mt-6 rounded-sm border border-white/[0.08] bg-obsidian-900/50 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-acid" />
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-acid">
            Attack Replay Theater
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className={cn(
            "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-sm border border-white/[0.1] px-4 text-xs uppercase tracking-wider transition-colors hover:border-acid/40 hover:text-acid",
          )}
          aria-pressed={playing}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setPlaying(false);
            }}
            className={cn(
              "min-h-[44px] shrink-0 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
              i === index ? "border-acid/50 bg-acid/10 text-acid" : "border-white/[0.06] text-foreground-subtle",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={cn("rounded-sm border bg-black/30 p-4", PHASE_COLOR[current.phase])}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
            <span>{current.phase}</span>
            <span className="text-foreground-subtle">·</span>
            <span>{current.severity}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{current.title}</p>
          {current.detail ? (
            <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{current.detail}</p>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 font-mono text-[10px] text-foreground-subtle">
        {steps.length} steps · step {index + 1} of {steps.length}
      </p>
    </div>
  );
}
