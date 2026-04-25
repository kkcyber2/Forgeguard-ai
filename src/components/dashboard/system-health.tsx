import * as React from "react";
import { HealthGauge } from "./health-gauge";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

/**
 * SystemHealth — admin compose: 4 gauges + a workers strip.
 * --------------------------------------------------------
 * Caller passes raw metrics; component decides tone + rendering.
 */

export interface SystemHealthMetrics {
  apiLatencyP95Ms: number;
  scanWorkers: { active: number; total: number };
  groqProxy: {
    status: "healthy" | "degraded" | "down";
    rps: number;
    sample: number[]; // last N RPS samples
  };
  queueDepth: number;
  uptime24h: number; // 0..1
}

export function SystemHealth({ m }: { m: SystemHealthMetrics }) {
  const workerPct = m.scanWorkers.total
    ? Math.round((m.scanWorkers.active / m.scanWorkers.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HealthGauge
          label="API p95"
          value={m.apiLatencyP95Ms}
          max={500}
          unit="ms"
          thresholds={{ warn: 180, crit: 320 }}
          caption="rolling 5m"
        />
        <HealthGauge
          label="Scan workers"
          value={workerPct}
          max={100}
          unit="%"
          higherIsBetter
          thresholds={{ warn: 60, crit: 80 }}
          caption={`${m.scanWorkers.active}/${m.scanWorkers.total} online`}
        />
        <HealthGauge
          label="Queue depth"
          value={m.queueDepth}
          max={200}
          unit="msg"
          thresholds={{ warn: 50, crit: 120 }}
          caption="in-flight probes"
        />
        <HealthGauge
          label="Uptime 24h"
          value={Math.round(m.uptime24h * 1000) / 10}
          max={100}
          unit="%"
          higherIsBetter
          thresholds={{ warn: 99.5, crit: 99.9 }}
          caption="error budget intact"
        />
      </div>

      <div
        className={cn(
          "flex items-center gap-4 rounded-sm border-hairline border-white/[0.06] bg-surface p-4",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              m.groqProxy.status === "healthy"
                ? "bg-acid animate-pulse-acid"
                : m.groqProxy.status === "degraded"
                ? "bg-amber-400"
                : "bg-threat animate-pulse-threat",
            )}
          />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              Groq proxy layer
            </p>
            <p className="font-mono text-xs text-foreground">
              {m.groqProxy.status} ·{" "}
              <span className="text-foreground-subtle">
                {m.groqProxy.rps.toFixed(1)} rps
              </span>
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <Sparkline
            data={m.groqProxy.sample}
            width={180}
            height={36}
            stroke={
              m.groqProxy.status === "healthy"
                ? "acid"
                : m.groqProxy.status === "degraded"
                ? "muted"
                : "threat"
            }
          />
        </div>
      </div>
    </div>
  );
}
