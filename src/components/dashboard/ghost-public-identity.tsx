"use client";

import { ShieldCheck } from "lucide-react";
import { SOVEREIGN_VERIFIED_LABEL } from "@/lib/access/ghost-mode";

/**
 * Public-facing identity seal when Ghost Protocol masks legal PII.
 */
export function GhostPublicIdentity({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-[3px] border-[0.5px] px-3 py-2"
      style={{
        borderColor: "rgba(74,74,74,0.45)",
        background: "rgba(74,74,74,0.1)",
      }}
    >
      <ShieldCheck
        size={compact ? 12 : 14}
        strokeWidth={1.5}
        style={{ color: "#4A4A4A" }}
      />
      <div>
        <p
          className="font-mono uppercase tracking-[0.14em] text-white/75"
          style={{ fontSize: compact ? 9 : 10 }}
        >
          {SOVEREIGN_VERIFIED_LABEL}
        </p>
        {!compact && (
          <p className="font-mono text-[9px] text-white/35 mt-0.5">
            Legal identity encrypted under Ghost Protocol
          </p>
        )}
      </div>
    </div>
  );
}
