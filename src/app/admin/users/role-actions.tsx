"use client";

import * as React from "react";
import { setUserRole, setVerified, setHackerRank } from "./actions";
import { OverrideDialog } from "./override-dialog";

interface RoleActionsProps {
  userId: string;
  userEmail: string;
  currentRole: "admin" | "client" | null;
  isVerified: boolean;
  currentPlan: string;
}

export function RoleActions({
  userId,
  userEmail,
  currentRole,
  isVerified,
  currentPlan,
}: RoleActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Promote / demote */}
      <form action={setUserRole}>
        <input type="hidden" name="user_id" value={userId} />
        <input
          type="hidden"
          name="role"
          value={currentRole === "admin" ? "client" : "admin"}
        />
        <button
          type="submit"
          className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-foreground-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          {currentRole === "admin" ? "Demote" : "Make admin"}
        </button>
      </form>

      {/* Verify / unverify */}
      <form action={setVerified}>
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="is_verified" value={String(!isVerified)} />
        <button
          type="submit"
          className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-foreground-muted transition-colors hover:border-acid/40 hover:text-acid"
        >
          {isVerified ? "Unverify" : "Verify"}
        </button>
      </form>

      {/* Set as TRAITOR — freezes wallet + stamps hacker_rank */}
      <form action={setHackerRank}>
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="hacker_rank" value="TRAITOR" />
        <button
          type="submit"
          className="rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.04)] px-2 py-1 text-[10px] font-medium font-mono uppercase tracking-[0.1em] text-[rgb(239,68,68)] transition-colors hover:border-[rgba(239,68,68,0.6)] hover:bg-[rgba(239,68,68,0.08)]"
        >
          TRAITOR
        </button>
      </form>

      {/* Override plan */}
      <OverrideDialog
        userId={userId}
        userEmail={userEmail}
        currentPlan={currentPlan}
      />
    </div>
  );
}
