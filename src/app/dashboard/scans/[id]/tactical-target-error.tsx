"use client";

import { AlertOctagon } from "lucide-react";
import { redactSecrets } from "@/lib/security/redact-secrets";

export function TacticalTargetError({
  failureReason,
  targetDiagnosticLogs,
  findingCount,
}: {
  failureReason: string | null;
  targetDiagnosticLogs: string | null;
  findingCount: number;
}) {
  const hasFailure = Boolean(failureReason?.trim() || targetDiagnosticLogs?.trim());
  if (findingCount > 0 || !hasFailure) return null;

  const diagnostic = redactSecrets(
    targetDiagnosticLogs?.trim() ||
      failureReason?.trim() ||
      "No diagnostic payload returned from target.",
  );

  return (
    <div
      className="rounded-sm border border-red-500/50 bg-red-950/30 p-5 shadow-[0_0_24px_rgba(239,68,68,0.12)]"
      role="alert"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertOctagon size={18} className="shrink-0 text-red-400" strokeWidth={1.75} />
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-red-400">
          Tactical Error: Target Provider rejected the Model ID/URL.
        </p>
      </div>
      {failureReason?.trim() && (
        <p className="mb-3 text-xs leading-relaxed text-red-200/90">
          {redactSecrets(failureReason)}
        </p>
      )}
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-red-300/70">
        Target diagnostic (raw)
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-sm border border-red-500/20 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-red-100">
        {diagnostic}
      </pre>
    </div>
  );
}
