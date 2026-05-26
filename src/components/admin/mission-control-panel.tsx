"use client";

import * as React from "react";
import { Crosshair, Users } from "lucide-react";
import {
  VerificationRow,
  type VerificationQueueRow,
} from "@/app/admin/verification/verification-row";
import { ReleaseFundsButton } from "@/app/admin/bounties/release-button";

export type BountyEscrowRow = {
  id: string;
  user_id: string;
  amount_usd: number;
  held_at: string | null;
  missionTitle: string | null;
  operatorEmail: string | null;
  operatorName: string | null;
};

interface MissionControlPanelProps {
  applicants: VerificationQueueRow[];
  escrows: BountyEscrowRow[];
}

export function MissionControlPanel({ applicants, escrows }: MissionControlPanelProps) {
  const [tab, setTab] = React.useState<"applicants" | "escrow">("applicants");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 py-1.5">
        <Crosshair size={11} className="ml-1 text-[#D1FF00]/70" />
        <button
          type="button"
          onClick={() => setTab("applicants")}
          className={`rounded px-2 py-1 font-mono text-[8px] uppercase tracking-widest transition-colors ${
            tab === "applicants"
              ? "bg-[#D1FF00]/10 text-[#D1FF00]"
              : "text-white/35 hover:text-white/60"
          }`}
        >
          Applicants ({applicants.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("escrow")}
          className={`rounded px-2 py-1 font-mono text-[8px] uppercase tracking-widest transition-colors ${
            tab === "escrow"
              ? "bg-[#D1FF00]/10 text-[#D1FF00]"
              : "text-white/35 hover:text-white/60"
          }`}
        >
          Escrow ({escrows.length})
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "applicants" ? (
          applicants.length === 0 ? (
            <p className="flex items-center gap-2 p-4 font-mono text-[10px] text-white/30">
              <Users size={12} />
              No clearance applicants in queue.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[8px] uppercase tracking-widest text-white/30">
                    <th className="px-3 py-2 text-left">Operator</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.slice(0, 12).map((row) => (
                    <VerificationRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : escrows.length === 0 ? (
          <p className="p-4 font-mono text-[10px] text-white/30">No held bounty escrows.</p>
        ) : (
          escrows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 hover:bg-white/[0.02]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] text-white/85">
                  {row.operatorName ?? row.operatorEmail ?? row.user_id.slice(0, 8)}
                </p>
                <p className="font-mono text-[8px] text-white/35">
                  {row.missionTitle ?? "Mission"} · $
                  {Number(row.amount_usd).toFixed(2)}
                </p>
              </div>
              <ReleaseFundsButton escrowId={row.id} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
