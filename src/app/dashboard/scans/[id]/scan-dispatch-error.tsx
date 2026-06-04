"use client";

import { AlertOctagon } from "lucide-react";
import type { ScanLogEntry } from "./live-log";

function extractRawError(logs: ScanLogEntry[], failureReason: string | null): string {
  for (const ev of logs) {
    if (ev.type !== "error") continue;
    const p = ev.payload as Record<string, unknown> | null;
    if (p && typeof p.raw_response_body === "string" && p.raw_response_body.trim()) {
      return p.raw_response_body;
    }
  }
  if (failureReason?.trim()) return failureReason;
  for (const ev of logs) {
    if (ev.type !== "error") continue;
    const p = ev.payload as Record<string, unknown> | null;
    if (p && typeof p.message === "string") return p.message;
  }
  return "";
}

export function ScanDispatchError({
  status,
  failureReason,
  initialLogs,
}: {
  status: string;
  failureReason: string | null;
  initialLogs: ScanLogEntry[];
}) {
  const raw = extractRawError(initialLogs, failureReason);
  if (status !== "failed" || !raw) return null;

  return (
    <div
      className="mb-4 rounded-sm border border-threat/40 bg-threat/10 p-4"
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertOctagon size={16} className="text-threat shrink-0" />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-threat">
          Target / engine response (raw)
        </p>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">
        {raw}
      </pre>
    </div>
  );
}
