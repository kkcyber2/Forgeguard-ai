"use client";

import * as React from "react";
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import type { ScanTargetPulse } from "@/components/dashboard/tactical-world-map";
import { TacticalWorldMapSkeleton } from "@/components/dashboard/tactical-world-map-skeleton";

const TacticalWorldMap = dynamic(
  () =>
    import("@/components/dashboard/tactical-world-map").then((m) => m.TacticalWorldMap),
  { ssr: false, loading: () => <TacticalWorldMapSkeleton dense /> },
);
import type { PopNodeId } from "@/lib/admin/resolve-scan-node";
import {
  AdminScanFeed,
  ScanInspectorDrawer,
  type AdminScanRow,
} from "@/components/admin/scan-inspector-drawer";
import { UserDirectory, type AdminOperatorRow } from "@/components/admin/user-directory";
import {
  BazaarTriagePanel,
  type PendingBazaarScript,
} from "@/components/admin/bazaar-triage-panel";
import {
  MissionControlPanel,
  type BountyEscrowRow,
} from "@/components/admin/mission-control-panel";
import type { VerificationQueueRow } from "@/app/admin/verification/verification-row";
import { PanelErrorBoundary } from "@/components/admin/panel-error-boundary";

export interface CommandCenterProps {
  activeScans: number;
  pendingTriage: number;
  applicantCount: number;
  scanTargets: ScanTargetPulse[];
  pulseNodeIds: PopNodeId[];
  operators: AdminOperatorRow[];
  scans: AdminScanRow[];
  pendingScripts: PendingBazaarScript[];
  verificationQueue: VerificationQueueRow[];
  bountyEscrows: BountyEscrowRow[];
}

export function CommandCenter({
  activeScans,
  pendingTriage,
  applicantCount,
  scanTargets,
  pulseNodeIds,
  operators,
  scans,
  pendingScripts,
  verificationQueue,
  bountyEscrows,
}: CommandCenterProps) {
  const [search, setSearch] = React.useState("");
  const [inspectScanId, setInspectScanId] = React.useState<string | null>(null);
  const [overlayTab, setOverlayTab] = React.useState<"bazaar" | "mission">("bazaar");

  return (
    <>
      <div className="-mx-2 flex flex-col gap-3 md:-mx-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Global search — email, user ID, IP…"
              autoComplete="off"
              className="w-full rounded border border-white/[0.08] bg-black/50 py-2.5 pl-9 pr-3 font-mono text-[11px] text-white placeholder:text-white/25 focus:border-[#D1FF00]/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[8px] uppercase tracking-widest">
            <span className="rounded border border-[#D1FF00]/25 bg-[#D1FF00]/5 px-2 py-1 text-[#D1FF00]/90">
              {activeScans} live scans
            </span>
            <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-white/45">
              {pendingTriage} bazaar pending
            </span>
            <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-white/45">
              {applicantCount} applicants
            </span>
          </div>
        </div>

        <div className="grid min-h-[640px] gap-3 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="relative flex min-h-[360px] flex-1 flex-col overflow-hidden rounded border border-white/[0.06] bg-black/30">
              <div className="border-b border-white/[0.06] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#D1FF00]/80">
                  Live world map · scans + attack_logs
                </p>
              </div>
              <PanelErrorBoundary label="Live map">
                <TacticalWorldMap
                  activeScans={activeScans}
                  scanTargets={scanTargets}
                  pulseNodeIds={pulseNodeIds}
                  dense
                  attackPulses
                />
              </PanelErrorBoundary>
              <PanelErrorBoundary label="Scan feed">
                <AdminScanFeed scans={scans} onSelect={setInspectScanId} />
              </PanelErrorBoundary>
            </div>

            <div className="flex h-[220px] min-h-0 flex-col overflow-hidden rounded border border-white/[0.06] bg-black/30">
              <div className="flex border-b border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setOverlayTab("bazaar")}
                  className={`flex-1 px-3 py-2 font-mono text-[9px] uppercase tracking-widest ${
                    overlayTab === "bazaar"
                      ? "border-b border-[#D1FF00]/50 text-[#D1FF00]"
                      : "text-white/35 hover:text-white/55"
                  }`}
                >
                  Bazaar triage
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayTab("mission")}
                  className={`flex-1 px-3 py-2 font-mono text-[9px] uppercase tracking-widest ${
                    overlayTab === "mission"
                      ? "border-b border-[#D1FF00]/50 text-[#D1FF00]"
                      : "text-white/35 hover:text-white/55"
                  }`}
                >
                  Mission control
                </button>
              </div>
              <PanelErrorBoundary label={overlayTab === "bazaar" ? "Bazaar triage" : "Mission control"}>
                {overlayTab === "bazaar" ? (
                  <BazaarTriagePanel scripts={pendingScripts} />
                ) : (
                  <MissionControlPanel
                    applicants={verificationQueue}
                    escrows={bountyEscrows}
                  />
                )}
              </PanelErrorBoundary>
            </div>
          </div>

          <div className="flex min-h-[640px] flex-col overflow-hidden rounded border border-white/[0.06] bg-black/30">
            <PanelErrorBoundary label="User directory">
              <UserDirectory operators={operators} searchQuery={search} />
            </PanelErrorBoundary>
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
