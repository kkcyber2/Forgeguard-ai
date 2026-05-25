"use client";

import { GhostPublicIdentity } from "@/components/dashboard/ghost-public-identity";
import { operatorAlias } from "@/lib/access/ghost-mode";

interface Props {
  operatorId: string;
  fullName: string | null;
  signatureData: string | null;
  isGhostActive: boolean;
  isOwnProfile: boolean;
}

/**
 * Mission Escrow — operator legal handshake panel.
 * Ghost operators expose only the sovereign verification seal publicly.
 */
export function MissionEscrowIdentity({
  operatorId,
  fullName,
  signatureData,
  isGhostActive,
  isOwnProfile,
}: Props) {
  const showGhostPublic = isGhostActive && !isOwnProfile;

  return (
    <div
      className="rounded-[4px] p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <p
        className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        Mission Escrow · Identity Seal
      </p>

      {showGhostPublic ? (
        <GhostPublicIdentity />
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">
              Legal name
            </p>
            <p className="font-mono text-sm text-white/85">
              {isGhostActive ? operatorAlias(operatorId) : fullName ?? "—"}
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">
              Digital signature
            </p>
            {signatureData && !isGhostActive ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureData}
                alt="Operator signature"
                className="max-h-16 rounded-[3px] border border-white/10 bg-black/40 px-2 py-1"
              />
            ) : isGhostActive ? (
              <GhostPublicIdentity compact />
            ) : (
              <p className="font-mono text-[10px] text-white/40">Not on file</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
