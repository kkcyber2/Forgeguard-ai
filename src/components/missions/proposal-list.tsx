"use client";

/**
 * ProposalList — Client sees all proposals for their mission.
 * Can accept or reject each one.
 */

import { useTransition } from "react";
import { CheckCircle2, XCircle, Clock, Coins } from "lucide-react";
import { acceptProposal, rejectProposal } from "./actions";

interface Proposal {
  id: string;
  hacker_id: string;
  pitch: string;
  timeline: string | null;
  ask_credits: number;
  status: string;
  created_at: string;
}

interface Props {
  missionId: string;
  proposals: Proposal[];
  isOwner: boolean;
  missionStatus: string;
}

export function ProposalList({ missionId, proposals, isOwner, missionStatus }: Props) {
  if (proposals.length === 0) {
    return (
      <div
        className="rounded-[4px] p-5 text-center"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.2)" }}>
          No Proposals Yet
        </p>
        <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
          Operators haven't pitched on this mission yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
        {proposals.length} Proposal{proposals.length !== 1 ? "s" : ""}
      </p>
      {proposals.map((p) => (
        <ProposalRow
          key={p.id}
          proposal={p}
          missionId={missionId}
          isOwner={isOwner}
          missionStatus={missionStatus}
        />
      ))}
    </div>
  );
}

function ProposalRow({
  proposal,
  missionId,
  isOwner,
  missionStatus,
}: {
  proposal: Proposal;
  missionId: string;
  isOwner: boolean;
  missionStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  const canAct = isOwner && missionStatus === "open" && proposal.status === "pending";

  function handleAccept() {
    startTransition(() => { void acceptProposal({ proposalId: proposal.id, missionId }); });
  }
  function handleReject() {
    startTransition(() => { void rejectProposal({ proposalId: proposal.id }); });
  }

  const statusColor =
    proposal.status === "accepted" ? "#D1FF00"
    : proposal.status === "rejected" ? "rgba(255,100,100,0.6)"
    : "rgba(255,255,255,0.25)";

  return (
    <div
      className="rounded-[4px] p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `0.5px solid ${proposal.status === "accepted" ? "rgba(209,255,0,0.2)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      {/* Hacker ID (truncated) + status */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.25)" }}>
          OP:{proposal.hacker_id.slice(0, 8)}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: statusColor }}>
          {proposal.status}
        </span>
      </div>

      {/* Pitch */}
      <p className="mb-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
        {proposal.pitch}
      </p>

      {/* Meta row */}
      <div className="mb-3 flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        {proposal.timeline && (
          <span className="flex items-center gap-1">
            <Clock size={10} strokeWidth={1.5} />
            {proposal.timeline}
          </span>
        )}
        {proposal.ask_credits > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#D1FF00", opacity: 0.75 }}>
            <Coins size={10} strokeWidth={1.5} />
            {proposal.ask_credits.toLocaleString()} cr
          </span>
        )}
      </div>

      {/* Action buttons — only for owner on pending proposals */}
      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[3px] py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-all disabled:opacity-50"
            style={{ background: "#D1FF00", color: "#050505" }}
          >
            <CheckCircle2 size={11} strokeWidth={2} />
            Accept
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[3px] py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-all disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,100,100,0.3)",
              color: "rgba(255,100,100,0.8)",
            }}
          >
            <XCircle size={11} strokeWidth={2} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
