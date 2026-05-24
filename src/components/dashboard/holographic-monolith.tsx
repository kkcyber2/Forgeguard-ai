"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";
import { VIEW_MODE_ACCENTS } from "@/lib/access/parallel-sovereignty";

function GlareLayer({
  glareX,
  glareY,
  accent,
}: {
  glareX: ReturnType<typeof useSpring>;
  glareY: ReturnType<typeof useSpring>;
  accent: string;
}) {
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const unsub = glareX.on("change", () => {
      if (!divRef.current) return;
      const x = glareX.get();
      const y = glareY.get();
      divRef.current.style.background = `radial-gradient(
        320px 240px at ${x * 100}% ${y * 100}%,
        rgba(255,255,255,0.07) 0%,
        ${accent}14 30%,
        transparent 70%
      )`;
    });
    return unsub;
  }, [glareX, glareY, accent]);

  return (
    <div
      ref={divRef}
      className="pointer-events-none absolute inset-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

function ThreatRing({ accent }: { accent: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      fill="none"
      aria-hidden
    >
      <circle cx="100" cy="100" r="92" stroke={accent} strokeWidth="0.5" strokeDasharray="8 16">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 100 100"
          to="360 100 100"
          dur="28s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="100"
        cy="100"
        r="72"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.4"
        strokeDasharray="4 24"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 100 100"
          to="0 100 100"
          dur="18s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

/**
 * Ambient holographic panel — sits behind dashboard content, below top nav (z-0).
 */
export function DashboardHolographicMonolith({
  viewMode,
  className,
}: {
  viewMode: ViewMode;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const accent = VIEW_MODE_ACCENTS[viewMode].primary;

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const glareX = useSpring(rawX, { stiffness: 60, damping: 18 });
  const glareY = useSpring(rawY, { stiffness: 60, damping: 18 });

  React.useEffect(() => {
    if (prefersReduced) return;
    const handler = (e: MouseEvent) => {
      rawX.set(e.clientX / window.innerWidth);
      rawY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [rawX, rawY, prefersReduced]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-0 top-14 bottom-0 z-0 hidden w-[38%] select-none lg:block",
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-6 xl:inset-10"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${accent}08 0%, transparent 70%)`,
        }}
      >
        <ThreatRing accent={accent} />
        <motion.div
          className="absolute inset-8"
          animate={prefersReduced ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              border: "0.5px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, rgba(0,0,0,0.08) 100%)",
              boxShadow:
                "0 0 0 0.5px rgba(255,255,255,0.06), 0 24px 80px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <GlareLayer glareX={glareX} glareY={glareY} accent={accent} />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
                backgroundSize: "100% 3px",
              }}
            />
            <div className="absolute inset-0 flex flex-col justify-between p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                  />
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                    style={{ color: accent }}
                  >
                    {VIEW_MODE_ACCENTS[viewMode].label}
                  </span>
                </div>
                <span className="font-mono text-[9px] tracking-widest text-white/25">
                  PARALLEL / OS
                </span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 opacity-40">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                  Sovereign Layer
                </p>
              </div>
              <div
                className="h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
