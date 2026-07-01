"use client";

import Link from "next/link";
import { Lock, Users } from "lucide-react";

/** Team E2EE settings — links to Intel Hub Teams tab for key exchange. */
export function TeamE2eeSettings() {
  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-5">
      <div className="flex items-center gap-2">
        <Lock size={14} className="text-foreground-subtle" />
        <p className="text-eyebrow text-foreground-subtle">Team E2EE</p>
      </div>
      <p className="mt-2 text-xs text-foreground-muted">
        End-to-end encrypted team channels use a shared passphrase stored in your browser session.
        Unlock encryption in Intel Hub → Teams after creating or joining a team.
      </p>
      <Link
        href="/dashboard/intel"
        className="mt-4 inline-flex items-center gap-2 rounded-sm border border-white/10 px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-white/[0.04]"
      >
        <Users size={12} />
        Open Intel Hub Teams
      </Link>
    </div>
  );
}
