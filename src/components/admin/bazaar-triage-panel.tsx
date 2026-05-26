"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Store,
  X,
  XCircle,
} from "lucide-react";

export type PendingBazaarScript = {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  price_usd: number | null;
  audit_risk_score: number | null;
  audit_verdict: string | null;
  created_at: string;
};

interface BazaarTriagePanelProps {
  scripts: PendingBazaarScript[];
}

function RiskDot({ score }: { score: number | null }) {
  const normalized = score == null ? 0 : score > 10 ? score / 10 : score;
  const color =
    normalized >= 8 ? "bg-red-400" : normalized >= 5 ? "bg-amber-400" : "bg-[#D1FF00]";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[8px] text-white/45">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {score != null ? normalized.toFixed(1) : "—"}
    </span>
  );
}

function ScriptInspectDrawer({
  scriptId,
  onClose,
  onAction,
}: {
  scriptId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const [script, setScript] = React.useState<{
    name: string;
    code: string | null;
    language: string | null;
    audit_verdict: string | null;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"verify" | "reject" | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/bazaar/script?id=${scriptId}`);
        const j = (await res.json()) as {
          ok?: boolean;
          script?: typeof script;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.script) {
          setError(j.error ?? "Failed to load script");
          return;
        }
        setScript(j.script);
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  async function handleVerdict(verdict: "cleared" | "rejected") {
    setBusy(verdict === "cleared" ? "verify" : "reject");
    setError(null);
    try {
      const res = await fetch("/api/admin/bazaar/verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: scriptId, verdict }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Action failed");
        return;
      }
      onAction();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-white/[0.08] bg-[#050505] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#D1FF00]/80">
            Script inspect
          </p>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 size={14} className="animate-spin" />
              <span className="font-mono text-[10px]">Loading…</span>
            </div>
          )}
          {error && !loading && (
            <p className="font-mono text-[10px] text-red-400">{error}</p>
          )}
          {script && !loading && (
            <div className="space-y-3">
              <p className="font-mono text-[12px] font-semibold text-white">{script.name}</p>
              <p className="font-mono text-[9px] uppercase text-white/40">
                {script.language ?? "unknown"} · {script.audit_verdict ?? "pending"}
              </p>
              {script.code ? (
                <pre className="max-h-[320px] overflow-auto rounded border border-white/[0.06] bg-black/50 p-3 font-mono text-[9px] leading-relaxed text-white/70">
                  {script.code.slice(0, 8000)}
                  {script.code.length > 8000 ? "\n… truncated" : ""}
                </pre>
              ) : (
                <p className="font-mono text-[10px] text-white/35">No code attached.</p>
              )}
            </div>
          )}
        </div>
        {script && !loading && (
          <div className="flex gap-2 border-t border-white/[0.06] p-4">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleVerdict("cleared")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#D1FF00]/40 bg-[#D1FF00]/10 py-2 font-mono text-[9px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
            >
              {busy === "verify" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <ShieldCheck size={11} />
              )}
              Verify & publish
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleVerdict("rejected")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 py-2 font-mono text-[9px] uppercase tracking-widest text-red-300 disabled:opacity-40"
            >
              {busy === "reject" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <XCircle size={11} />
              )}
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BazaarTriagePanel({ scripts }: BazaarTriagePanelProps) {
  const router = useRouter();
  const [inspectId, setInspectId] = React.useState<string | null>(null);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <Store size={11} className="text-[#D1FF00]/70" />
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
            Bazaar triage · {scripts.length} pending
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {scripts.length === 0 ? (
            <p className="p-4 font-mono text-[10px] text-white/30">Queue clear — no scripts pending audit.</p>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2 hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[10px] text-white/85">{script.name}</p>
                  <p className="font-mono text-[8px] text-white/35">
                    {script.language ?? "—"} · ${Number(script.price_usd ?? 0).toFixed(2)}
                  </p>
                </div>
                <RiskDot score={script.audit_risk_score} />
                <button
                  type="button"
                  onClick={() => setInspectId(script.id)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded border border-[#D1FF00]/30 bg-[#D1FF00]/5 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#D1FF00] hover:bg-[#D1FF00]/10"
                >
                  Inspect
                  <ChevronRight size={10} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {inspectId && (
        <ScriptInspectDrawer
          scriptId={inspectId}
          onClose={() => setInspectId(null)}
          onAction={() => router.refresh()}
        />
      )}
    </>
  );
}
