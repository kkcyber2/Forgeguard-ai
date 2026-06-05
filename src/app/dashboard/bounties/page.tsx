"use client";

/**
 * /dashboard/bounties — Bounty Vault
 * ─────────────────────────────────────────────────────────────────────────────
 * Submit a vulnerability report and receive an automated CVSS 4.0 score
 * powered by DeepSeek-R1 via OpenRouter (falls back to heuristic classifier).
 *
 * The triage engine also cross-references your existing Aegis WAF rules to
 * determine whether the reported attack vector is already defended.
 *
 * Aesthetic: Cold Obsidian + Acid Green, sharp 4 px corners, monospaced data
 * grids, staggered Framer Motion entry animations.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  FileSearch,
  Globe,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CvssResult } from "@/app/api/bounty/triage/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TriageForm {
  title:              string;
  description:        string;
  reproduction:       string;
  impact:             string;
  affected_component: string;
  target_domain:      string;
  scan_id:            string;
}

interface TriageResponse {
  ok:     boolean;
  result: CvssResult;
  mode:   "deepseek-r1" | "heuristic" | "heuristic_fallback";
  error?: string;
  code?:  string;
  domain?:string;
}

interface VerifyResponse {
  ok:           boolean;
  domain?:      string;
  token?:       string;
  verified?:    boolean;
  verified_at?: string;
  txt_record?:  string;
  instructions?:string;
  dns_checked?: boolean;
  message?:     string;
  error?:       string;
  expired?:     boolean;
}

// Escrow status from bounty_escrow table
type EscrowStatus = "held" | "released" | "refunded" | "pending";

interface EscrowBadgeProps {
  status: EscrowStatus;
  amount?: number;
  currency?: string;
}

// ─── Severity palette ─────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical: {
    label:      "CRITICAL",
    color:      "text-threat",
    border:     "border-threat/30",
    bg:         "bg-threat/[0.06]",
    dot:        "bg-threat animate-pulse",
    glow:       "shadow-[0_0_24px_rgba(255,46,77,0.2)]",
    scoreColor: "text-threat",
  },
  high: {
    label:      "HIGH",
    color:      "text-amber-400",
    border:     "border-amber-400/30",
    bg:         "bg-amber-400/[0.06]",
    dot:        "bg-amber-400",
    glow:       "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    scoreColor: "text-amber-400",
  },
  medium: {
    label:      "MEDIUM",
    color:      "text-yellow-500",
    border:     "border-yellow-500/30",
    bg:         "bg-yellow-500/[0.05]",
    dot:        "bg-yellow-500",
    glow:       "",
    scoreColor: "text-yellow-500",
  },
  low: {
    label:      "LOW",
    color:      "text-acid",
    border:     "border-acid/30",
    bg:         "bg-acid/[0.05]",
    dot:        "bg-acid",
    glow:       "",
    scoreColor: "text-acid",
  },
  none: {
    label:      "NONE",
    color:      "text-steel-500",
    border:     "border-white/[0.08]",
    bg:         "bg-obsidian-800/40",
    dot:        "bg-steel-700",
    glow:       "",
    scoreColor: "text-steel-500",
  },
} as const;

// ─── CVSS Detail Row ─────────────────────────────────────────────────────────

function CvssRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
        {label}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-white/60">{value || "—"}</span>
    </div>
  );
}

// ─── Triage Result Card ───────────────────────────────────────────────────────

function TriageResultCard({
  result,
  mode,
}: {
  result: CvssResult;
  mode:   TriageResponse["mode"];
}) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = React.useState(false);
  const sev = SEV_CONFIG[result.severity] ?? SEV_CONFIG.none;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn(
        "rounded-sm border p-5 flex flex-col gap-4",
        sev.border, sev.bg, sev.glow,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xs border",
            sev.border, "bg-obsidian-700/60",
          )}>
            <ShieldAlert size={16} strokeWidth={1.5} className={sev.color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.14em]", sev.color)}>
                {sev.label}
              </span>
              <span className="h-px w-3 bg-white/[0.08]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-subtle">
                {mode === "deepseek-r1" ? "DeepSeek-R1" : "Heuristic"}
              </span>
            </div>
            <p className="text-[11px] text-foreground-muted mt-0.5 font-mono">
              {result.cvss_vector}
            </p>
          </div>
        </div>

        {/* Score badge */}
        <div className={cn(
          "flex flex-col items-center justify-center rounded-xs border px-4 py-2 min-w-[72px]",
          sev.border, "bg-obsidian-800/60",
        )}>
          <span className={cn("text-2xl font-bold tabular-nums leading-none", sev.scoreColor)}>
            {result.cvss_score.toFixed(1)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground-subtle mt-1">
            CVSS 4.0
          </span>
        </div>
      </div>

      {/* Rationale */}
      <div className="rounded-xs border border-white/[0.04] bg-obsidian-900/40 px-4 py-3">
        <p className="text-sm text-foreground-muted leading-relaxed">{result.rationale}</p>
      </div>

      {/* Aegis coverage */}
      <div className={cn(
        "flex items-start gap-3 rounded-xs border px-4 py-3",
        result.aegis_coverage.covered
          ? "border-acid/20 bg-acid/[0.04]"
          : "border-white/[0.05] bg-obsidian-800/30",
      )}>
        {result.aegis_coverage.covered
          ? <ShieldCheck size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-acid" />
          : <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber-400" />
        }
        <div>
          <p className={cn(
            "font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
            result.aegis_coverage.covered ? "text-acid" : "text-amber-400",
          )}>
            {result.aegis_coverage.covered ? "Aegis coverage detected" : "No Aegis coverage"}
          </p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {result.aegis_coverage.recommendation}
          </p>
          {result.aegis_coverage.matching_rules.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.aegis_coverage.matching_rules.map((r) => (
                <span key={r} className="font-mono text-[9px] rounded-xs border border-acid/20 bg-acid/[0.06] px-2 py-0.5 text-acid">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable CVSS breakdown */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-foreground-subtle hover:text-foreground transition-colors"
      >
        {expanded
          ? <ChevronDown size={12} strokeWidth={1.5} />
          : <ChevronRight size={12} strokeWidth={1.5} />
        }
        <span className="font-mono uppercase tracking-[0.1em]">CVSS 4.0 vector breakdown</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-xs border border-white/[0.05] bg-obsidian-900/60 px-4 py-2">
              <CvssRow label="Threat Signature"       value={result.attack_vector} />
              <CvssRow label="Attack Complexity"   value={result.attack_complexity} />
              <CvssRow label="Privileges Required" value={result.privileges_required} />
              <CvssRow label="User Interaction"    value={result.user_interaction} />
              <CvssRow label="Confidentiality"     value={result.confidentiality} />
              <CvssRow label="Integrity"           value={result.integrity} />
              <CvssRow label="Availability"        value={result.availability} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  required,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
          {label}
        </label>
        {required && (
          <span className="text-threat text-[10px]">*</span>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-foreground-subtle -mt-0.5">{hint}</p>
      )}
      {children}
    </div>
  );
}

const inputClass = cn(
  "w-full rounded-xs border border-white/[0.08] bg-obsidian-800/60",
  "px-3 py-2 font-mono text-[12px] text-foreground placeholder:text-foreground-subtle",
  "focus:outline-none focus:border-white/[0.18] focus:ring-0 transition-colors",
);

const textareaClass = cn(inputClass, "resize-none leading-relaxed");

// ─── Escrow Badge ─────────────────────────────────────────────────────────────

function EscrowBadge({ status, amount, currency = "USD" }: EscrowBadgeProps) {
  const config = {
    held:     { label: "Held in Escrow",  color: "text-amber-400",  border: "border-amber-400/30", bg: "bg-amber-400/[0.07]",  icon: Clock     },
    pending:  { label: "Pending Review",  color: "text-steel-400",  border: "border-white/[0.08]", bg: "bg-obsidian-800/40",   icon: Clock     },
    released: { label: "Released",        color: "text-acid",       border: "border-acid/30",      bg: "bg-acid/[0.07]",       icon: BadgeCheck},
    refunded: { label: "Refunded",        color: "text-steel-500",  border: "border-white/[0.06]", bg: "bg-obsidian-800/30",   icon: DollarSign},
  } as const;

  const cfg  = config[status] ?? config.pending;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-2 rounded-xs border px-3 py-1.5",
      cfg.border, cfg.bg,
    )}>
      <Icon size={11} strokeWidth={1.5} className={cfg.color} />
      <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", cfg.color)}>
        {cfg.label}
      </span>
      {amount !== undefined && amount > 0 && (
        <span className={cn("font-mono text-[10px] font-bold tabular-nums", cfg.color)}>
          ${amount.toFixed(2)} {currency}
        </span>
      )}
    </div>
  );
}

// ─── Domain Verifier Panel ────────────────────────────────────────────────────

function DomainVerifier({
  domain,
  onVerified,
}: {
  domain: string;
  onVerified: (verified: boolean) => void;
}) {
  const [loading, setLoading]       = React.useState(false);
  const [issuing, setIssuing]       = React.useState(false);
  const [state, setState]           = React.useState<VerifyResponse | null>(null);
  const [copied, setCopied]         = React.useState(false);

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";

  async function issue() {
    if (!cleanDomain || issuing) return;
    setIssuing(true);
    try {
      const res = await fetch("/api/bounty/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ domain: cleanDomain, action: "issue" }),
      });
      const json = (await res.json()) as VerifyResponse;
      setState(json);
      onVerified(json.verified ?? false);
    } catch (err) {
      setState({ ok: false, error: (err as Error).message });
    } finally {
      setIssuing(false);
    }
  }

  async function check() {
    if (!cleanDomain || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bounty/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ domain: cleanDomain, action: "check" }),
      });
      const json = (await res.json()) as VerifyResponse;
      setState(json);
      onVerified(json.verified ?? false);
    } catch (err) {
      setState({ ok: false, error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function copyToken() {
    if (!state?.txt_record) return;
    void navigator.clipboard.writeText(state.txt_record).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!cleanDomain) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className={cn(
        "mt-2 rounded-xs border p-4 flex flex-col gap-3",
        state?.verified
          ? "border-acid/25 bg-acid/[0.05]"
          : "border-white/[0.07] bg-obsidian-900/50",
      )}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={11} strokeWidth={1.5} className={state?.verified ? "text-acid" : "text-foreground-muted"} />
            <span className={cn(
              "font-mono text-[10px] uppercase tracking-[0.12em]",
              state?.verified ? "text-acid" : "text-foreground-subtle",
            )}>
              {state?.verified ? "Ownership verified" : `Verify: ${cleanDomain}`}
            </span>
          </div>
          {state?.verified && (
            <BadgeCheck size={14} strokeWidth={1.5} className="text-acid" />
          )}
          {!state?.verified && !state?.token && (
            <button
              onClick={() => void issue()}
              disabled={issuing}
              className="flex items-center gap-1.5 rounded-xs border border-white/[0.08] bg-obsidian-700/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted hover:text-foreground transition-colors disabled:opacity-40"
            >
              {issuing ? <Loader2 size={9} className="animate-spin" /> : <Lock size={9} strokeWidth={1.5} />}
              Issue token
            </button>
          )}
        </div>

        {/* Token display + copy */}
        {state?.txt_record && !state.verified && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-foreground-subtle">
              Add this DNS TXT record to <span className="font-mono text-foreground-muted">{cleanDomain}</span>:
            </p>
            <div className="flex items-center gap-2 rounded-xs border border-white/[0.06] bg-obsidian-800/60 px-3 py-2">
              <code className="flex-1 font-mono text-[11px] text-acid break-all">
                {state.txt_record}
              </code>
              <button
                onClick={copyToken}
                className="shrink-0 rounded-xs p-1 hover:bg-white/[0.06] transition-colors"
                title="Copy TXT record"
              >
                {copied
                  ? <CheckCircle2 size={11} strokeWidth={1.5} className="text-acid" />
                  : <Copy size={11} strokeWidth={1.5} className="text-foreground-muted" />
                }
              </button>
            </div>

            <button
              onClick={() => void check()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xs border border-acid/20 bg-acid/[0.05] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-acid hover:bg-acid/[0.10] transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <BadgeCheck size={10} strokeWidth={1.5} />}
              Check DNS verification
            </button>
          </div>
        )}

        {/* Check result */}
        {state && !state.verified && state.dns_checked && (
          <p className="text-[11px] text-amber-400/80">{state.message}</p>
        )}
        {state?.error && (
          <p className="text-[11px] text-threat">{state.error}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM: TriageForm = {
  title:              "",
  description:        "",
  reproduction:       "",
  impact:             "",
  affected_component: "LLM endpoint",
  target_domain:      "",
  scan_id:            "",
};

// Escrow loaded from bounty_escrow on mount
const MOCK_ESCROW: { status: EscrowStatus; amount: number } | null = null;

// ─── Wizard step config ───────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 1, label: "Discovery",    hint: "Name and describe the vulnerability" },
  { id: 2, label: "Exploitation", hint: "Reproduction chain and impact" },
  { id: 3, label: "Scope",        hint: "Target, component, and scan link" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function WizardProgress({
  step,
  onGoTo,
  canGoTo,
}: {
  step: number;
  onGoTo: (s: number) => void;
  canGoTo: (s: number) => boolean;
}) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {WIZARD_STEPS.map((s, i) => {
        const done    = step > s.id;
        const active  = step === s.id;
        const allowed = canGoTo(s.id);
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              disabled={!allowed}
              onClick={() => allowed && onGoTo(s.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xs transition-colors",
                active  ? "bg-acid/10" : "hover:bg-white/[0.04]",
                !allowed ? "cursor-default" : "cursor-pointer",
              )}
            >
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-xs border font-mono text-[11px] font-bold transition-colors",
                done   ? "border-acid/50 bg-acid/20 text-acid"
                       : active ? "border-acid/40 bg-acid/[0.08] text-acid"
                       : "border-white/[0.1] bg-obsidian-800/40 text-zinc-400",
              )}>
                {done ? <CheckCircle2 size={12} strokeWidth={2} /> : s.id}
              </div>
              <span className={cn(
                "font-mono text-[9px] uppercase tracking-widest hidden sm:block",
                active ? "text-acid" : done ? "text-zinc-400" : "text-zinc-600",
              )}>
                {s.label}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-px mx-1 transition-colors",
                done ? "bg-acid/30" : "bg-white/[0.05]",
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BountiesPage() {
  const reduce = useReducedMotion();

  const [step, setStep]             = React.useState(1);
  const [form, setForm]             = React.useState<TriageForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult]         = React.useState<TriageResponse | null>(null);
  const [error, setError]           = React.useState<string | null>(null);
  const [domainVerified, setDomainVerified] = React.useState(false);
  const [escrow, setEscrow]         = React.useState<{ status: EscrowStatus; amount: number } | null>(MOCK_ESCROW);

  React.useEffect(() => {
    async function loadEscrow() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("bounty_escrow")
        .select("status, amount_usd")
        .eq("user_id", user.id)
        .eq("status", "held")
        .maybeSingle();
      if (data) {
        setEscrow({
          status: (data.status ?? "held") as EscrowStatus,
          amount: Number(data.amount_usd ?? 0),
        });
      }
    }
    void loadEscrow();
  }, []);

  function patch(field: keyof TriageForm, value: string) {
    if (field === "target_domain") setDomainVerified(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const needsDomainVerif = form.target_domain.trim().length > 0 && !domainVerified;
  const step1Valid = form.title.trim().length > 0 && form.description.trim().length > 0;
  const step2Valid = true; // reproduction + impact are optional
  function canGoTo(s: number): boolean {
    if (s === 1) return true;
    if (s === 2) return step1Valid;
    if (s === 3) return step1Valid && step2Valid;
    return false;
  }

  async function handleSubmit() {
    if (!form.title || !form.description) return;
    if (needsDomainVerif) {
      setError("Verify your domain ownership before submitting a bounty against it.");
      return;
    }

    setSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, string> = {
        title:              form.title,
        description:        form.description,
        reproduction:       form.reproduction,
        impact:             form.impact,
        affected_component: form.affected_component || "LLM endpoint",
      };
      if (form.target_domain.trim()) body.target_domain = form.target_domain.trim();
      if (form.scan_id.trim()) body.scan_id = form.scan_id.trim();

      const res = await fetch("/api/bounty/triage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const json = (await res.json()) as TriageResponse;

      if (!res.ok || !json.ok) {
        if (json.code === "DOMAIN_GATE") {
          setError(`Domain "${json.domain ?? form.target_domain}" is not verified. Complete domain verification first.`);
        } else {
          setError(json.error ?? `HTTP ${res.status}`);
        }
        return;
      }

      setResult(json);
      setEscrow({ status: "pending", amount: 0 });
    } catch (err: unknown) {
      setError((err as Error).message ?? "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <Trophy size={16} strokeWidth={1.5} className="text-acid" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
            Bounty Vault
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Vulnerability Triage
        </h1>
        <p className="max-w-xl text-sm text-foreground-muted">
          Submit a finding for automated CVSS 4.0 scoring. DeepSeek-R1 analyses
          the report and cross-references your Aegis rules to determine coverage.
        </p>
      </motion.div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: "AI model",          value: "DeepSeek-R1", icon: Zap,        tone: "acid"    },
          { label: "Scoring standard",  value: "CVSS 4.0",   icon: FileSearch,  tone: "neutral" },
          { label: "Aegis cross-ref",   value: "Automatic",  icon: ShieldCheck, tone: "secure"  },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-obsidian-800/40 px-4 py-3"
          >
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-xs border",
              tone === "secure" || tone === "acid"
                ? "border-acid/20 bg-acid/[0.06]"
                : "border-white/[0.06] bg-obsidian-700/40",
            )}>
              <Icon size={12} strokeWidth={1.5} className={cn(tone !== "neutral" ? "text-acid" : "text-foreground-muted")} />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tabular-nums text-white/90">{value}</p>
              <p className="font-mono text-[11px] text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Two-column layout: wizard left, result right ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Multi-step wizard */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-sm border border-white/[0.06] bg-obsidian-800/20 p-6"
        >
          {/* Progress indicator */}
          <WizardProgress step={step} onGoTo={setStep} canGoTo={canGoTo} />

          {/* Step label */}
          <div className="mb-5 flex items-center gap-2 border-b border-white/[0.04] pb-4">
            <Upload size={12} strokeWidth={1.5} className="text-zinc-400" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                Step {step} — {WIZARD_STEPS[step - 1].label}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {WIZARD_STEPS[step - 1].hint}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Discovery ─────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <Field label="Vulnerability title" required>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => patch("title", e.target.value)}
                    placeholder="e.g. Prompt injection via tool-call return value"
                    maxLength={200}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Description"
                  hint="Explain the vulnerability, the affected system, and how it can be exploited."
                  required
                >
                  <textarea
                    value={form.description}
                    onChange={(e) => patch("description", e.target.value)}
                    placeholder="Describe the vulnerability in detail..."
                    rows={6}
                    maxLength={5000}
                    className={textareaClass}
                  />
                </Field>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className={cn(
                      "flex items-center gap-2 rounded-sm border px-5 py-2 text-sm font-medium transition-all",
                      "border-acid/30 bg-acid/[0.07] text-acid hover:bg-acid/[0.14]",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    Next: Exploitation
                    <ChevronRight size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Exploitation ──────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <Field
                  label="Reproduction steps"
                  hint="Step-by-step instructions to reproduce the issue."
                >
                  <textarea
                    value={form.reproduction}
                    onChange={(e) => patch("reproduction", e.target.value)}
                    placeholder={"1. Send the following payload to /api/chat...\n2. Observe the model outputs..."}
                    rows={5}
                    maxLength={3000}
                    className={textareaClass}
                  />
                </Field>
                <Field
                  label="Impact assessment"
                  hint="What data or capabilities could an attacker access?"
                >
                  <textarea
                    value={form.impact}
                    onChange={(e) => patch("impact", e.target.value)}
                    placeholder="Attacker can exfiltrate system prompts, bypass content policy..."
                    rows={4}
                    maxLength={2000}
                    className={textareaClass}
                  />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    <ChevronDown size={13} strokeWidth={1.5} className="-rotate-90" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className={cn(
                      "flex items-center gap-2 rounded-sm border px-5 py-2 text-sm font-medium transition-all",
                      "border-acid/30 bg-acid/[0.07] text-acid hover:bg-acid/[0.14]",
                    )}
                  >
                    Next: Scope
                    <ChevronRight size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Scope ─────────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Affected component">
                    <input
                      type="text"
                      value={form.affected_component}
                      onChange={(e) => patch("affected_component", e.target.value)}
                      placeholder="LLM endpoint / RAG pipeline / Agent"
                      maxLength={200}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Scan ID (optional)"
                    hint="Link to an existing scan to cross-check Aegis rules."
                  >
                    <input
                      type="text"
                      value={form.scan_id}
                      onChange={(e) => patch("scan_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      maxLength={36}
                      className={inputClass}
                    />
                  </Field>
                </div>

                {/* Target domain */}
                <Field
                  label="Target domain (optional)"
                  hint="Required if submitting a finding against an external target."
                >
                  <input
                    type="text"
                    value={form.target_domain}
                    onChange={(e) => patch("target_domain", e.target.value)}
                    placeholder="api.example.com"
                    maxLength={253}
                    className={inputClass}
                  />
                </Field>

                <AnimatePresence>
                  {form.target_domain.trim() && (
                    <DomainVerifier domain={form.target_domain} onVerified={setDomainVerified} />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {needsDomainVerif && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3 rounded-xs border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3"
                    >
                      <Lock size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber-400" />
                      <p className="text-sm text-amber-400">
                        Verify domain ownership before submitting a bounty against this target.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3 rounded-xs border border-threat/30 bg-threat/[0.07] px-4 py-3"
                    >
                      <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-threat" />
                      <p className="text-sm text-threat">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    <ChevronDown size={13} strokeWidth={1.5} className="-rotate-90" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !form.title || !form.description || needsDomainVerif}
                    onClick={() => void handleSubmit()}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-sm border px-6 py-2.5 text-sm font-medium transition-all duration-150",
                      "border-acid/30 bg-acid/[0.07] text-acid",
                      "hover:bg-acid/[0.12] disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                        Analysing with DeepSeek-R1…
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={13} strokeWidth={1.5} />
                        Run CVSS Triage
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Result panel */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FileSearch size={12} strokeWidth={1.5} className="text-foreground-muted" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              Triage result
            </span>
          </div>

          <AnimatePresence mode="wait">
            {!result && !submitting && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 rounded-sm border border-white/[0.05] bg-obsidian-900/40 px-6 py-16 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xs border border-white/[0.06] bg-obsidian-800/60">
                  <ShieldAlert size={16} strokeWidth={1.5} className="text-foreground-subtle" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-muted">
                    Awaiting submission
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
                    Fill the form and run triage
                  </p>
                </div>
              </motion.div>
            )}

            {submitting && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 rounded-sm border border-white/[0.05] bg-obsidian-900/40 px-6 py-16 text-center"
              >
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-acid" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-muted">
                    DeepSeek-R1 is scoring…
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
                    CVSS 4.0 analysis in progress
                  </p>
                </div>
              </motion.div>
            )}

            {result && !submitting && (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                <TriageResultCard result={result.result} mode={result.mode} />

                {/* Escrow payment badge */}
                {escrow && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="flex items-center gap-3 rounded-xs border border-white/[0.06] bg-obsidian-800/30 px-4 py-3"
                  >
                    <DollarSign size={12} strokeWidth={1.5} className="shrink-0 text-foreground-muted" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle mr-auto">
                      Escrow status
                    </span>
                    <EscrowBadge
                      status={escrow.status}
                      amount={escrow.amount}
                    />
                  </motion.div>
                )}

                {/* Re-submit prompt */}
                <button
                  onClick={() => { setResult(null); setError(null); }}
                  className="flex items-center justify-center gap-2 rounded-xs border border-white/[0.06] bg-obsidian-800/30 px-4 py-2 text-xs text-foreground-subtle hover:text-foreground transition-colors"
                >
                  <CheckCircle2 size={11} strokeWidth={1.5} />
                  Submit another finding
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info panel */}
          {!result && (
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-2 rounded-sm border border-white/[0.04] bg-obsidian-800/20 px-4 py-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle mb-1">
                How triage works
              </p>
              {[
                "Report submitted to DeepSeek-R1 via OpenRouter",
                "CVSS 4.0 vector scored against AI/LLM attack taxonomy",
                "Aegis WAF rules cross-referenced for coverage gaps",
                "Falls back to heuristic classifier if LLM unavailable",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-px font-mono text-[10px] text-acid shrink-0">{i + 1}.</span>
                  <p className="text-[11px] text-foreground-subtle leading-relaxed">{step}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
