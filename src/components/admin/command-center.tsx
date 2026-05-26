"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { LiveWorldMap, type ScanTargetPulse } from "@/components/dashboard/live-world-map";
import type { PopNodeId } from "@/lib/admin/resolve-scan-node";
import {
  AdminScanFeed,
  ScanInspectorDrawer,
  type AdminScanRow,
} from "@/components/admin/scan-inspector-drawer";
import { UserDirectory, type AdminOperatorRow } from "@/components/admin/user-directory";

export interface CommandCenterProps {
  activeScans: number;
  scanTargets: ScanTargetPulse[];
  pulseNodeIds: PopNodeId[];
  operators: AdminOperatorRow[];
  scans: AdminScanRow[];
}

export function CommandCenter({
  activeScans,
  scanTargets,
  pulseNodeIds,
  operators,
  scans,
}: CommandCenterProps) {
  const [search, setSearch] = React.useState("");
  const [inspectScanId, setInspectScanId] = React.useState<string | null>(null);

  return (
    <>
      <div className="-mx-2 flex flex-col gap-3 md:-mx-4">
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter operators — email, name, company, IP…"
            autoComplete="off"
            className="w-full rounded border border-white/[0.08] bg-black/50 py-2.5 pl-9 pr-3 font-mono text-[11px] text-white placeholder:text-white/25 focus:border-[#D1FF00]/40 focus:outline-none"
          />
        </div>

        <div className="grid min-h-[520px] gap-3 lg:grid-cols-[1fr_300px]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded border border-white/[0.06] bg-black/30">
            <div className="border-b border-white/[0.06] px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#D1FF00]/80">
                Live world map · scans + attack_logs
              </p>
            </div>
            <LiveWorldMap
              activeScans={activeScans}
              scanTargets={scanTargets}
              pulseNodeIds={pulseNodeIds}
              dense
              attackPulses
            />
            <AdminScanFeed scans={scans} onSelect={setInspectScanId} />
          </div>

          <div className="flex min-h-[520px] flex-col overflow-hidden rounded border border-white/[0.06] bg-black/30">
            <UserDirectory operators={operators} searchQuery={search} />
          </div>
        </div>
      </div>

      <ScanInspectorDrawer
        scanId={inspectScanId}
        onClose={() => setInspectScanId(null)}
      />
    </>
  );
}
