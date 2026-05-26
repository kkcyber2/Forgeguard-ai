"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  activateUser,
  addCredits,
  banUser,
  deleteUser,
  setOperatorRank,
} from "@/app/admin/users/actions";

export interface AdminOperatorRow {
  id: string;
  email: string;
  fullName: string | null;
  company: string | null;
  role: string | null;
  hackerRank: string | null;
  accessLevel: number | null;
  accountStatus: string;
  walletBalance: number;
  lastIp: string | null;
  isVerified: boolean;
}

interface UserDirectoryProps {
  operators: AdminOperatorRow[];
  searchQuery: string;
}

function PowerButton({
  label,
  tone = "neutral",
  onClick,
  disabled,
}: {
  label: string;
  tone?: "neutral" | "danger" | "secure";
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles =
    tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
      : tone === "secure"
        ? "border-[#D1FF00]/35 bg-[#D1FF00]/10 text-[#D1FF00] hover:bg-[#D1FF00]/15"
        : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest transition-colors disabled:opacity-40 ${styles}`}
    >
      {label}
    </button>
  );
}

export function UserDirectory({ operators, searchQuery }: UserDirectoryProps) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const filtered = operators.filter((op) => {
    if (!q) return true;
    return (
      op.email.toLowerCase().includes(q) ||
      (op.fullName ?? "").toLowerCase().includes(q) ||
      (op.company ?? "").toLowerCase().includes(q) ||
      (op.lastIp ?? "").includes(q)
    );
  });

  async function runAction(userId: string, fn: () => Promise<{ error?: string }>) {
    setBusyId(userId);
    setMsg(null);
    const res = await fn();
    setBusyId(null);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          User directory · {filtered.length}
        </p>
      </div>
      {msg && (
        <p className="px-3 py-1 font-mono text-[9px] text-red-400/90">{msg}</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 font-mono text-[10px] text-white/35">No operators match.</p>
        ) : (
          filtered.map((op) => (
            <div
              key={op.id}
              className="border-b border-white/[0.04] px-3 py-2.5 hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-white/85">{op.email}</p>
                  <p className="truncate font-mono text-[9px] text-white/45">
                    {op.fullName ?? "—"} · {op.company ?? "no org"}
                  </p>
                  <p className="font-mono text-[8px] text-white/30">
                    {op.hackerRank ?? "RECRUIT"} · L{op.accessLevel ?? 1} · $
                    {op.walletBalance.toFixed(2)}
                    {op.lastIp ? ` · ${op.lastIp}` : ""}
                  </p>
                  {op.accountStatus !== "active" && (
                    <span className="font-mono text-[8px] uppercase text-red-400">
                      {op.accountStatus}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <PowerButton
                  label="Ban"
                  tone="danger"
                  disabled={busyId === op.id}
                  onClick={() =>
                    void runAction(op.id, () => banUser(op.id))
                  }
                />
                <PowerButton
                  label="Activate"
                  tone="secure"
                  disabled={busyId === op.id}
                  onClick={() =>
                    void runAction(op.id, () => activateUser(op.id))
                  }
                />
                <PowerButton
                  label="Delete"
                  tone="danger"
                  disabled={busyId === op.id}
                  onClick={() => {
                    if (!window.confirm(`Delete ${op.email}? Irreversible.`)) return;
                    void runAction(op.id, () => deleteUser(op.id));
                  }}
                />
                <PowerButton
                  label="Rank"
                  disabled={busyId === op.id}
                  onClick={() => {
                    const rank = window.prompt(
                      "Set hacker_rank (RECRUIT|HACKER|ELITE|TRAITOR):",
                      op.hackerRank ?? "HACKER",
                    );
                    if (!rank) return;
                    const level = window.prompt(
                      "Set access_level (1-5):",
                      String(op.accessLevel ?? 2),
                    );
                    void runAction(op.id, () =>
                      setOperatorRank(
                        op.id,
                        rank.toUpperCase(),
                        level ? parseInt(level, 10) : undefined,
                      ),
                    );
                  }}
                />
                <PowerButton
                  label="+ Credits"
                  tone="secure"
                  disabled={busyId === op.id}
                  onClick={() => {
                    const amount = window.prompt("Credit amount (USD):", "25");
                    if (!amount) return;
                    void runAction(op.id, () =>
                      addCredits(op.id, parseFloat(amount)),
                    );
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
