"use client";

import * as React from "react";
import { Loader2, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProofRow {
  findingId: string;
  attack_name: string | null;
  severity: string;
  technique: string | null;
  ruleId: string | null;
  verified: boolean;
  afterBlocked: boolean;
  error: string | null;
}

interface ProofResponse {
  scanId: string;
  summary: { total: number; verified: number; notVerified: number };
  results: ProofRow[];
}

/**
 * Phase 3D — Aegis closed-loop verification panel.
 * Renders per-finding "Rule proven to block attack ✓/✗" next to the findings
 * report. Calls GET /api/aegis/verify-closed-loop?scanId=... (local proof,
 * no live target hit).
 */
export function AegisVerificationPanel({ scanId }: { scanId: string }) {
  const [data, setData] = React.useState<ProofResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runProof() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aegis/verify-closed-loop?scanId=${encodeURIComponent(scanId)}`,
        { method: "GET" },
      );
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as ProofResponse;
      setData(json);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run once on mount for a sealed scan.
  React.useEffect(() => {
    void runProof();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return (
    <div className="rounded-sm border border-acid/20 bg-acid/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} strokeWidth={1.75} className="text-acid" />
          <span className="text-eyebrow text-foreground-subtle">
            Aegis Closed-Loop Verification
          </span>
        </div>
        <button
          type="button"
          onClick={() => void runProof()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xs border border-white/[0.08] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground-muted transition-colors hover:border-acid/30 hover:text-acid disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <RefreshCw size={10} />
          )}
          Re-run proof
        </button>
      </div>

      {loading && !data && (
        <p className="font-mono text-[11px] text-foreground-muted">
          Proving generated rules against recorded attack payloads…
        </p>
      )}

      {error && (
        <p className="font-mono text-[11px] text-threat">{error}</p>
      )}

      {data && (
        <>
          <p className="mb-3 text-[11px] text-foreground-muted">
            {data.summary.verified}/{data.summary.total} generated rules proven to block their attack.
            Local deterministic proof — no live target contacted.
          </p>
          {data.results.length === 0 ? (
            <p className="font-mono text-[11px] text-foreground-muted">
              No findings to verify yet for this scan.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.results.map((r) => (
                <li
                  key={r.findingId}
                  className="flex items-center justify-between gap-3 rounded-sm border border-white/[0.06] bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-foreground">
                      {r.attack_name ?? r.technique ?? "finding"}
                    </p>
                    <p className="truncate font-mono text-[9px] text-foreground-subtle">
                      {r.technique ?? "?"} · {r.ruleId ?? "no rule"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold",
                      r.verified
                        ? "bg-acid/10 text-acid"
                        : "bg-threat/10 text-threat",
                    )}
                    title={r.error ?? undefined}
                  >
                    {r.verified ? (
                      <ShieldCheck size={11} />
                    ) : (
                      <ShieldX size={11} />
                    )}
                    {r.verified ? "Rule proven to block attack ✓" : "Not proven ✗"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
