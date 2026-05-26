"use client";

import * as React from "react";
import { X } from "lucide-react";
import { inspectScan, type ScanInspectResult } from "@/app/admin/actions/scan-inspect";

export interface AdminScanRow {
  id: string;
  user_id: string;
  target_url: string;
  target_model: string | null;
  status: string;
  finding_count: number | null;
  created_at: string;
  operatorEmail?: string;
  companyName?: string | null;
}

export function ScanInspectorDrawer({
  scanId,
  onClose,
}: {
  scanId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<ScanInspectResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!scanId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    void inspectScan(scanId).then((res) => {
      setLoading(false);
      if (res.error) setError(res.error);
      else setData(res);
    });
  }, [scanId]);

  if (!scanId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#050505] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
              Scan inspector
            </p>
            <p className="font-mono text-[11px] text-[#D1FF00]">{scanId.slice(0, 12)}…</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <p className="font-mono text-[10px] text-white/45">Loading raw telemetry…</p>
          )}
          {error && (
            <p className="font-mono text-[10px] text-red-400/90">{error}</p>
          )}
          {data?.operator && (
            <section>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/35">
                Operator metadata
              </p>
              <pre className="overflow-x-auto rounded border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] text-white/70">
                {JSON.stringify(data.operator, null, 2)}
              </pre>
            </section>
          )}
          {data?.scan && (
            <section>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/35">
                Scan row (raw JSON)
              </p>
              <pre className="max-h-48 overflow-auto rounded border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] text-white/70">
                {JSON.stringify(data.scan, null, 2)}
              </pre>
            </section>
          )}
          {data?.report && (
            <section>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/35">
                Scan report
              </p>
              <pre className="max-h-64 overflow-auto rounded border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] text-white/70">
                {JSON.stringify(data.report, null, 2)}
              </pre>
            </section>
          )}
          {data?.logs && data.logs.length > 0 && (
            <section>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/35">
                Scan logs ({data.logs.length})
              </p>
              <pre className="max-h-96 overflow-auto rounded border border-white/[0.06] bg-black/40 p-3 font-mono text-[9px] text-white/65">
                {JSON.stringify(data.logs, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminScanFeed({
  scans,
  onSelect,
}: {
  scans: AdminScanRow[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-t border-white/[0.06]">
      <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
        Recent scans — click for raw JSON
      </p>
      <div className="max-h-40 overflow-y-auto">
        {scans.slice(0, 30).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className="flex w-full flex-col items-start border-b border-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.03]"
          >
            <span className="font-mono text-[10px] text-white/75 truncate w-full">
              {s.target_url}
            </span>
            <span className="font-mono text-[8px] text-white/35">
              {s.status} · {s.operatorEmail ?? s.user_id.slice(0, 8)} ·{" "}
              {s.companyName ?? "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
