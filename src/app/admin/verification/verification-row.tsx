"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Brain, Loader2 } from "lucide-react";
import { GrantAccessButton } from "./grant-button";
import { runAdminIdentityAudit } from "./audit-actions";

export interface VerificationQueueRow {
  id: string;
  email: string | null;
  full_name: string | null;
  identity_audit_score: number | null;
  identity_audit_status: string | null;
  identity_audit_notes: string | null;
  identity_document_path: string | null;
}

function ConfidenceMeter({ score }: { score: number | null }) {
  const value = score != null ? Math.min(100, Math.max(0, Number(score))) : 0;
  const mismatch = value < 80;
  const barColor = mismatch ? "#FF3131" : value >= 60 ? "#D1FF00" : "#FF3131";

  return (
    <div className="min-w-[120px] space-y-1">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest">
        <span className={mismatch ? "text-[#FF3131]" : "text-[#D1FF00]"}>
          {score != null ? `${value.toFixed(0)}%` : "—"}
        </span>
        {mismatch && score != null && (
          <AlertTriangle size={10} className="text-[#FF3131]" />
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export function VerificationRow({ row }: { row: VerificationQueueRow }) {
  const [summary, setSummary] = useState<string | null>(row.identity_audit_notes);
  const [score, setScore] = useState<number | null>(
    row.identity_audit_score != null ? Number(row.identity_audit_score) : null,
  );
  const [mismatch, setMismatch] = useState(
    score != null && score < 80,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAudit() {
    setError(null);
    startTransition(async () => {
      const res = await runAdminIdentityAudit(row.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.result) {
        setScore(res.result.confidence_score);
        setSummary(res.result.audit_notes);
        setMismatch(res.result.mismatch);
      }
    });
  }

  return (
    <tr
      className={`border-b-[0.5px] border-white/[0.05] hover:bg-white/[0.02] ${
        mismatch ? "bg-[#FF3131]/[0.04]" : ""
      }`}
    >
      <td className="px-4 py-3">
        <p className={`font-medium ${mismatch ? "text-[#FF3131]" : "text-white/90"}`}>
          {row.full_name ?? "—"}
        </p>
        <p className="text-zinc-500">{row.email}</p>
        {row.identity_document_path && (
          <p className="mt-1 truncate font-mono text-[9px] text-zinc-600">
            {row.identity_document_path}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <ConfidenceMeter score={score} />
      </td>
      <td className="px-4 py-3 uppercase text-zinc-400">
        {row.identity_audit_status ?? "none"}
      </td>
      <td className="max-w-xs px-4 py-3">
        <p className="truncate font-mono text-[10px] text-zinc-500">{summary ?? "—"}</p>
        {error && (
          <p className="mt-1 font-mono text-[9px] text-[#FF3131]">{error}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleAudit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#D1FF00]/30 bg-[#D1FF00]/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
          >
            {pending ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Brain size={10} />
            )}
            AI audit
          </button>
          <GrantAccessButton userId={row.id} />
        </div>
      </td>
    </tr>
  );
}
