"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ScanCard, type ScanCardData } from "@/components/dashboard/scan-card";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { recoverStuckScan } from "@/app/dashboard/scans/actions";
import { cn } from "@/lib/utils";

export interface ScanHistoryEntry {
  id: string;
  card: ScanCardData;
  recoverable: boolean;
}

export function ScanHistory({ scans }: { scans: ScanHistoryEntry[] }) {
  const router = useRouter();
  const [recoveringId, setRecoveringId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRecover = async (scanId: string) => {
    setRecoveringId(scanId);
    setError(null);
    try {
      const result = await recoverStuckScan(scanId);
      if (!result.ok) {
        setError(result.error ?? "Recovery failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Recovery failed. Try again.");
    } finally {
      setRecoveringId(null);
    }
  };

  return (
    <>
      {error ? (
        <p className="mb-3 font-mono text-[11px] text-threat">{error}</p>
      ) : null}
      <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scans.map((entry) => (
          <StaggerItem key={entry.id}>
            <div className="relative">
              <ScanCard scan={entry.card} />
              {entry.recoverable ? (
                <button
                  type="button"
                  disabled={recoveringId === entry.id}
                  onClick={() => void handleRecover(entry.id)}
                  className={cn(
                    "absolute bottom-4 right-4 z-10",
                    "rounded-sm border border-amber-400/40 bg-amber-400/10",
                    "px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
                    "text-amber-300 transition-colors hover:bg-amber-400/20",
                    "disabled:opacity-50",
                  )}
                >
                  {recoveringId === entry.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={10} className="animate-spin" />
                      Recovering
                    </span>
                  ) : (
                    "[RECOVERY]"
                  )}
                </button>
              ) : null}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}
