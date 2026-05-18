"use client";

/**
 * EngineStatus
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls /api/health/engine every 30 seconds and surfaces a dismissible
 * in-page warning banner when the Railway orchestrator (Agathon) is
 * unreachable. Silent when the engine is healthy or when the env var is
 * not configured (local dev / preview branch).
 *
 * Placement: top of the main content area, before page children.
 * Design: amber-tone, minimal, one-line — does not alarm, informs.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EngineHealthStatus = "unconfigured" | "healthy" | "degraded" | "offline";

interface HealthPayload {
  ok: boolean;
  status: EngineHealthStatus;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;   // 30 s steady-state
const RETRY_INTERVAL_MS = 10_000;  // 10 s after a failure (back-off lite)

// ─── Component ────────────────────────────────────────────────────────────────

export function EngineStatus() {
  const [health, setHealth]       = React.useState<HealthPayload | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [checking, setChecking]   = React.useState(false);

  const check = React.useCallback(async () => {
    setChecking(true);
    try {
      const res  = await fetch("/api/health/engine", { cache: "no-store" });
      const data = (await res.json()) as HealthPayload;
      setHealth(data);
      // If we get a good response after being dismissed, reset the dismiss state
      // so a subsequent failure shows the banner again.
      if (data.ok) setDismissed(false);
    } catch {
      setHealth({ ok: false, status: "offline", latencyMs: 0, error: "Fetch failed" });
    } finally {
      setChecking(false);
    }
  }, []);

  // Initial probe + recurring interval
  React.useEffect(() => {
    void check();

    const interval = setInterval(
      () => { void check(); },
      health?.ok === false ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS,
    );

    return () => clearInterval(interval);
  // Re-register interval when health changes so the retry rate adjusts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check, health?.ok]);

  // Nothing to show: healthy, unconfigured, or user dismissed.
  const showBanner =
    !dismissed &&
    health !== null &&
    !health.ok &&
    health.status !== "unconfigured";

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="engine-status"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              "mb-5 flex items-center gap-3 rounded-xs border px-4 py-2.5",
              health?.status === "degraded"
                ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-300"
                : "border-red-500/25 bg-red-500/[0.06] text-red-300",
            )}
          >
            <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0" />

            <p className="flex-1 font-mono text-[11px]">
              {health?.status === "degraded"
                ? `Engine degraded — orchestrator responded ${health?.httpStatus ?? "with error"}. Scans may be slow.`
                : "Engine offline — ForgeGuard Agathon is unreachable. New scans will fail until the engine recovers."}
            </p>

            {/* Manual re-check */}
            <button
              onClick={() => { void check(); }}
              disabled={checking}
              className="shrink-0 rounded-xs p-1 opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
              aria-label="Retry engine check"
            >
              <RefreshCw
                size={12}
                strokeWidth={1.5}
                className={checking ? "animate-spin" : ""}
              />
            </button>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-xs p-1 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Dismiss engine warning"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
