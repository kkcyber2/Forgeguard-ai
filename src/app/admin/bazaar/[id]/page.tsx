"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Store, ChevronLeft, Tag, DollarSign, Code2,
  AlertTriangle, CheckCircle2, XCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuditVerdict = "pending_audit" | "cleared" | "rejected" | null;

interface BazaarScript {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  tags: string[] | null;
  price_credits: number | null;
  risk_score: number | null;
  audit_verdict: AuditVerdict;
  is_published: boolean;
  created_at: string;
  code: string | null;
  author_id: string;
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="font-mono text-[10px] text-steel-600">N/A</span>;
  const cls =
    score >= 8 ? "text-threat border-threat/30 bg-threat/5"
    : score >= 5 ? "text-amber-400 border-amber-400/30 bg-amber-400/5"
    : "text-acid border-acid/30 bg-acid/5";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-widest", cls)}>
      {score >= 8 && <AlertTriangle size={9} />}
      {score.toFixed(1)} / 10
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: AuditVerdict }) {
  if (!verdict || verdict === "pending_audit")
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-steel-700/40 bg-steel-900/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-steel-400">
        <Loader2 size={8} />Pending
      </span>
    );
  if (verdict === "cleared")
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-acid/30 bg-acid/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-acid">
        <CheckCircle2 size={8} />Cleared
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-threat/30 bg-threat/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-threat">
      <XCircle size={8} />Rejected
    </span>
  );
}

function CodeViewer({ code, language }: { code: string; language: string | null }) {
  const highlighted = React.useMemo(() => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped
      .replace(/(\d+\.?\d*)\b/g, '<span style="color:#D19A66">$1</span>')
      .replace(
        /\b(import|from|def|class|return|if|elif|else|for|while|in|not|and|or|True|False|None|async|await|const|let|var|function|export|default|interface|type|extends|implements|try|except|catch|finally|raise|throw|new|typeof|instanceof|null|undefined|void|break|continue|pass|yield|lambda|with|as|global|nonlocal|is|del)\b/g,
        '<span style="color:#C678DD">$1</span>',
      )
      .replace(
        /(#[^\n]*|\/\/[^\n]*)/g,
        '<span style="color:#5C6370;font-style:italic">$1</span>',
      );
  }, [code]);

  return (
    <div className="relative rounded-sm border border-steel-900/60 bg-obsidian-950">
      <div className="flex items-center gap-2 border-b border-steel-900/60 px-4 py-2">
        <Code2 size={10} className="text-steel-600" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-steel-600">{language ?? "plaintext"}</span>
        <span className="ml-auto font-mono text-[9px] text-steel-700">READ-ONLY</span>
      </div>
      <div className="flex max-h-[520px] overflow-auto">
        <div className="select-none border-r border-steel-900/40 bg-obsidian-950 px-3 py-4 text-right">
          {code.split("\n").map((_, i) => (
            <div key={i} className="font-mono text-[11px] leading-5 text-steel-700">{i + 1}</div>
          ))}
        </div>
        <pre
          contentEditable={false}
          suppressContentEditableWarning
          className="flex-1 overflow-x-auto px-5 py-4 font-mono text-[11px] leading-5 text-steel-300"
          dangerouslySetInnerHTML={{ __html: highlighted }}
          style={{ margin: 0, whiteSpace: "pre" }}
        />
      </div>
    </div>
  );
}

export default function AdminBazaarScriptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const scriptId = params.id;

  const [script, setScript] = React.useState<BazaarScript | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [loadingFetch, setLoadingFetch] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<"verify" | "reject" | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionDone, setActionDone] = React.useState<AuditVerdict>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/bazaar/script?id=${scriptId}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setFetchError((j as { error?: string }).error ?? `HTTP ${res.status}`);
          return;
        }
        const j = await res.json();
        setScript(j.script ?? null);
      } catch {
        setFetchError("Network error fetching script.");
      } finally {
        setLoadingFetch(false);
      }
    }
    load();
  }, [scriptId]);

  async function handleVerdict(verdict: "cleared" | "rejected") {
    setActionError(null);
    setActionLoading(verdict === "cleared" ? "verify" : "reject");
    try {
      const res = await fetch("/api/admin/bazaar/verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: scriptId, verdict }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setActionError(j.error ?? "Action failed."); return; }
      setActionDone(verdict);
      setScript((prev) => prev ? { ...prev, audit_verdict: verdict, is_published: verdict === "cleared" } : prev);
    } catch {
      setActionError("Network error.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loadingFetch) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-steel-600">
        <Loader2 size={16} className="animate-spin" />
        <span className="font-mono text-[12px]">Loading script&hellip;</span>
      </div>
    );
  }

  if (fetchError || !script) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="rounded-sm border border-threat/30 bg-threat/5 p-6 text-center">
          <AlertTriangle size={20} className="mx-auto mb-2 text-threat" />
          <p className="font-mono text-[12px] text-threat">{fetchError ?? "Script not found."}</p>
          <button onClick={() => router.push("/admin/bazaar")} className="mt-4 font-mono text-[11px] text-steel-400 underline underline-offset-2 hover:text-steel-200">
            &larr; Back to Bazaar Triage
          </button>
        </div>
      </div>
    );
  }

  const currentVerdict = actionDone ?? script.audit_verdict;
  const alreadyActioned = currentVerdict === "cleared" || currentVerdict === "rejected";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <button
        onClick={() => router.push("/admin/bazaar")}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] text-steel-500 transition-colors hover:text-steel-300"
      >
        <ChevronLeft size={11} />&larr; Back to Bazaar Triage
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Store size={18} className="mt-0.5 shrink-0 text-acid" />
          <div>
            <h1 className="font-mono text-[16px] font-bold text-steel-100">{script.name}</h1>
            {script.description && (
              <p className="mt-1 font-mono text-[11px] text-steel-500">{script.description}</p>
            )}
          </div>
        </div>
        <VerdictBadge verdict={currentVerdict} />
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 rounded-sm border border-steel-900/60 bg-obsidian-900/50 p-5 sm:grid-cols-4">
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-steel-600">Language</p>
          <div className="flex items-center gap-1.5">
            <Code2 size={10} className="text-steel-500" />
            <span className="font-mono text-[12px] text-steel-200">{script.language ?? "&mdash;"}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-steel-600">Price</p>
          <div className="flex items-center gap-1">
            <DollarSign size={10} className="text-steel-500" />
            <span className="font-mono text-[12px] text-steel-200">{script.price_credits ?? 0} cr</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-steel-600">Risk Score</p>
          <RiskBadge score={script.risk_score} />
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-steel-600">Submitted</p>
          <span className="font-mono text-[11px] text-steel-400">
            {new Date(script.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Tags */}
      {script.tags && script.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {script.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-sm border border-steel-900/60 bg-obsidian-950 px-2 py-0.5 font-mono text-[9px] text-steel-500">
              <Tag size={8} />{tag}
            </span>
          ))}
        </div>
      )}

      {/* Code viewer */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-steel-600">Source Code</p>
        {script.code ? (
          <CodeViewer code={script.code} language={script.language} />
        ) : (
          <div className="flex items-center justify-center rounded-sm border border-steel-900/40 bg-obsidian-950 py-12 text-center">
            <p className="font-mono text-[11px] text-steel-700">No code attached to this script.</p>
          </div>
        )}
      </div>

      {/* Success banner */}
      {actionDone && (
        <div className={cn(
          "flex items-center gap-3 rounded-sm border px-4 py-3",
          actionDone === "cleared" ? "border-acid/30 bg-acid/5" : "border-threat/30 bg-threat/5",
        )}>
          {actionDone === "cleared"
            ? <ShieldCheck size={14} className="shrink-0 text-acid" />
            : <XCircle size={14} className="shrink-0 text-threat" />}
          <p className={cn("font-mono text-[12px] font-semibold", actionDone === "cleared" ? "text-acid" : "text-threat")}>
            {actionDone === "cleared" ? "Script verified and published." : "Script rejected and hidden from marketplace."}
          </p>
        </div>
      )}

      {/* Error banner */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-sm border border-threat/30 bg-threat/5 px-4 py-3">
          <AlertTriangle size={13} className="shrink-0 text-threat" />
          <span className="font-mono text-[11px] text-threat">{actionError}</span>
        </div>
      )}

      {/* Action buttons */}
      {!alreadyActioned && (
        <div className="flex items-center gap-3 border-t border-steel-900/40 pt-4">
          <button
            onClick={() => handleVerdict("cleared")}
            disabled={!!actionLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm border border-acid/40 bg-acid/10 px-5 py-2.5",
              "font-mono text-[11px] font-semibold uppercase tracking-widest text-acid",
              "transition-colors hover:bg-acid/20 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {actionLoading === "verify"
              ? <><Loader2 size={11} className="animate-spin" />Publishing&hellip;</>
              : <><ShieldCheck size={11} />VERIFY &amp; PUBLISH</>}
          </button>
          <button
            onClick={() => handleVerdict("rejected")}
            disabled={!!actionLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm border border-threat/40 bg-threat/5 px-5 py-2.5",
              "font-mono text-[11px] font-semibold uppercase tracking-widest text-threat",
              "transition-colors hover:bg-threat/10 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {actionLoading === "reject"
              ? <><Loader2 size={11} className="animate-spin" />Rejecting&hellip;</>
              : <><XCircle size={11} />REJECT</>}
          </button>
          <span className="font-mono text-[10px] text-steel-700">Action is permanent and logged.</span>
        </div>
      )}
    </div>
  );
}
