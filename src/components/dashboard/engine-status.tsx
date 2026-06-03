"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribeEngineHealth,
  refreshEngineHealth,
  type ClientEngineHealth,
} from "@/services/engine-health.service";

export function EngineStatus() {
  const [health, setHealth] = React.useState<ClientEngineHealth | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => subscribeEngineHealth(setHealth), []);

  const showBanner =
    !dismissed &&
    health !== null &&
    !health.ok &&
    health.status !== "unconfigured";

  async function recheck() {
    setChecking(true);
    try {
      await refreshEngineHealth();
    } finally {
      setChecking(false);
    }
  }

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
              "border-red-500/25 bg-red-500/[0.06] text-red-300",
            )}
          >
            <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0" />
            <p className="flex-1 font-mono text-[11px]">
              {health?.reason ?? "Bunker Shielding..."}
            </p>
            <button
              type="button"
              onClick={() => void recheck()}
              disabled={checking}
              className="shrink-0 rounded-xs p-1 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Retry engine check"
            >
              <RefreshCw
                size={12}
                strokeWidth={1.5}
                className={checking ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
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
