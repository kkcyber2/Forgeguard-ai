import { AlertTriangle } from "lucide-react";

export function ShellDegradedBanner({
  message,
}: {
  message?: string;
}) {
  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-[4px] border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5"
      role="status"
    >
      <AlertTriangle
        size={14}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-amber-300"
      />
      <p className="font-mono text-[11px] leading-relaxed text-amber-200/90">
        {message ??
          "Some dashboard telemetry is offline — navigation remains active."}
      </p>
    </div>
  );
}
