"use client";

import * as React from "react";
import {
  AlertOctagon,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Code2,
  Download,
  FileText,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Target,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface PoC {
  curl?: string;
  python?: string;
}

export interface Finding {
  id: string;
  attack: string;
  family: string;
  level?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cvss: number;
  exploitability?: number;
  impact?: number;
  reliability?: number;
  evidence?: string;
  rationale?: string;
  summary?: string;
  verdict?: boolean;
  cwe_references?: string[];
  remediation?: string;
  proof_of_concept?: PoC;
  remediation_snippet_key?: string;
  observed_at?: string;
}

export interface OWASPBucket {
  families: string[];
  max_cvss: number;
  count: number;
}

export interface ScanReport {
  executive_summary_md?: string;
  cvss_overall?: number;
  risk_label?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings?: Finding[];
  optimization_suggestions_md?: string;
  owasp_coverage?: Record<string, OWASPBucket>;
  attacks_run?: number;
  wall_seconds?: number;
  generation_cost_usd?: number;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const SEVERITY_CONFIG = {
  critical: {
    label: "CRITICAL",
    bg: "bg-threat/10",
    border: "border-threat/30",
    text: "text-threat",
    dot: "bg-threat animate-pulse",
    cvssColor: "text-threat",
  },
  high: {
    label: "HIGH",
    bg: "bg-threat/6",
    border: "border-threat/20",
    text: "text-orange-400",
    dot: "bg-orange-400",
    cvssColor: "text-orange-400",
  },
  medium: {
    label: "MEDIUM",
    bg: "bg-amber-400/5",
    border: "border-amber-400/20",
    text: "text-amber-300",
    dot: "bg-amber-400",
    cvssColor: "text-amber-300",
  },
  low: {
    label: "LOW",
    bg: "bg-acid/5",
    border: "border-acid/20",
    text: "text-acid",
    dot: "bg-acid",
    cvssColor: "text-acid",
  },
  info: {
    label: "INFO",
    bg: "bg-white/[0.02]",
    border: "border-white/[0.06]",
    text: "text-foreground-muted",
    dot: "bg-foreground-subtle",
    cvssColor: "text-foreground-muted",
  },
} as const;

const RISK_LABEL_CONFIG: Record<
  string,
  { color: string; glow: string }
> = {
  CRITICAL: { color: "text-threat", glow: "shadow-[0_0_16px_rgba(239,68,68,0.25)]" },
  HIGH:     { color: "text-orange-400", glow: "shadow-[0_0_16px_rgba(251,146,60,0.15)]" },
  MEDIUM:   { color: "text-amber-300", glow: "" },
  LOW:      { color: "text-acid", glow: "" },
  NONE:     { color: "text-foreground-muted", glow: "" },
};

const FAMILY_LABEL: Record<string, string> = {
  prompt_injection:        "Prompt Injection",
  data_exfiltration:       "Data Exfiltration",
  context_manipulation:    "Context Manipulation",
  adversarial_robustness:  "Adversarial Robustness",
  model_misuse:            "Model Misuse",
  token_smuggling:         "Token Smuggling",
  emotional_manipulation:  "Emotional Manipulation",
  invisible_injection:     "Invisible Injection",
  chain_of_thought_hijack: "CoT Hijack",
  system_prompt_extraction:"Sys-Prompt Extraction",
  rag_poisoning:           "RAG Poisoning",
  logic_jailbreak:         "Logic Jailbreak",
  autonomous_adversary:    "Autonomous Adversary",
  custom_tool:             "Custom Tool",
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Small helpers                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      <ClipboardCopy size={10} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SectionHead({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon size={13} strokeWidth={1.75} className="text-foreground-subtle" />
      <span className="text-eyebrow text-foreground-subtle">{label}</span>
    </div>
  );
}

function CWEChip({ cwe }: { cwe: string }) {
  return (
    <span className="inline-flex items-center rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted">
      {cwe}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  FindingCard                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const [open, setOpen] = React.useState(false);
  const [pocTab, setPocTab] = React.useState<"curl" | "python">("curl");

  const sev = finding.severity in SEVERITY_CONFIG
    ? finding.severity
    : ("info" as const);
  const cfg = SEVERITY_CONFIG[sev];
  const familyLabel = FAMILY_LABEL[finding.family] ?? finding.family ?? finding.attack;
  const poc = finding.proof_of_concept;
  const pocCode = poc ? (pocTab === "curl" ? poc.curl : poc.python) : undefined;

  return (
    <div
      className={cn(
        "rounded-sm border transition-colors",
        cfg.border,
        open ? cfg.bg : "border-white/[0.06] bg-surface hover:border-white/[0.1]",
      )}
    >
      {/* ── Header row ── */}
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Severity dot */}
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", cfg.dot)} />

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[11px] text-foreground-subtle">
              {finding.id}
            </span>
            <span className="text-sm font-medium text-foreground">
              {familyLabel}
            </span>
            {finding.level && (
              <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                {finding.level}
              </span>
            )}
          </div>
          {finding.summary && (
            <p className="mt-1 truncate text-xs text-foreground-muted">
              {finding.summary}
            </p>
          )}
          {/* CWE chips — visible in collapsed state */}
          {(finding.cwe_references?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {finding.cwe_references!.map((c) => (
                <CWEChip key={c} cwe={c} />
              ))}
            </div>
          )}
        </div>

        {/* CVSS + chevron */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className={cn("font-mono text-lg font-bold leading-none", cfg.cvssColor)}>
              {finding.cvss.toFixed(1)}
            </div>
            <div className={cn("text-[9px] font-semibold uppercase tracking-widest", cfg.text)}>
              {cfg.label}
            </div>
          </div>
          {open ? (
            <ChevronUp size={14} className="text-foreground-subtle" />
          ) : (
            <ChevronDown size={14} className="text-foreground-subtle" />
          )}
        </div>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-4 space-y-5">

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Exploitability", val: finding.exploitability },
              { label: "Impact",         val: finding.impact },
              { label: "Reliability",    val: finding.reliability },
            ].map(({ label, val }) =>
              val !== undefined ? (
                <div key={label} className="rounded border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                  <div className="font-mono text-base font-bold text-foreground">
                    {(val * 10).toFixed(0)}
                    <span className="text-[10px] text-foreground-subtle">/10</span>
                  </div>
                  <div className="text-[10px] text-foreground-subtle">{label}</div>
                </div>
              ) : null
            )}
          </div>

          {/* Evidence */}
          {finding.evidence && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                  Evidence — Model Response
                </span>
              </div>
              <pre className="overflow-x-auto rounded border border-threat/20 bg-threat/5 p-3 font-mono text-[11px] leading-relaxed text-threat/90 whitespace-pre-wrap break-words">
                {finding.evidence}
              </pre>
            </div>
          )}

          {/* Rationale */}
          {finding.rationale && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                Brain Rationale
              </span>
              <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                {finding.rationale}
              </p>
            </div>
          )}

          {/* Remediation */}
          {finding.remediation && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                Remediation
              </span>
              <div className="mt-1.5 rounded border border-acid/20 bg-acid/5 p-3">
                <p className="text-xs leading-relaxed text-acid/90">
                  {finding.remediation}
                </p>
              </div>
            </div>
          )}

          {/* Proof of Concept */}
          {poc && (poc.curl || poc.python) && (
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                  Proof of Concept
                </span>
                <div className="flex items-center gap-1 rounded border border-white/[0.06] bg-surface p-0.5">
                  {(["curl", "python"] as const).map((tab) => (
                    poc[tab] ? (
                      <button
                        key={tab}
                        onClick={() => setPocTab(tab)}
                        className={cn(
                          "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
                          pocTab === tab
                            ? "bg-white/[0.08] text-foreground"
                            : "text-foreground-muted hover:text-foreground",
                        )}
                      >
                        {tab === "curl" ? "cURL" : "Python"}
                      </button>
                    ) : null
                  ))}
                </div>
              </div>
              {pocCode && (
                <div className="relative rounded border border-white/[0.06] bg-black/40">
                  <div className="absolute right-2 top-2">
                    <CopyButton text={pocCode} />
                  </div>
                  <pre className="overflow-x-auto p-3 pt-8 font-mono text-[11px] leading-relaxed text-foreground-muted whitespace-pre">
                    {pocCode}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Verdict pill */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
              Attack Verdict
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-semibold",
                finding.verdict
                  ? "bg-threat/10 text-threat"
                  : "bg-acid/10 text-acid",
              )}
            >
              {finding.verdict ? "EXPLOITED" : "MITIGATED"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  RemediationRoadmap                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function RemediationRoadmap({ md }: { md: string }) {
  // Parse the markdown into numbered action items — renderer is intentionally
  // minimal so we don't need a heavy markdown dep on the client bundle.
  const lines = md.split("\n").filter(Boolean);
  const items: { priority: number; text: string; sub: string[] }[] = [];
  let current: (typeof items)[0] | null = null;

  for (const line of lines) {
    const topMatch = line.match(/^#+\s+(.+)/);
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    const bulletMatch = line.match(/^[-*]\s+(.+)/);

    if (topMatch) continue; // skip h1/h2 header
    if (numMatch) {
      current = { priority: items.length + 1, text: numMatch[1], sub: [] };
      items.push(current);
    } else if (bulletMatch && current) {
      current.sub.push(bulletMatch[1]);
    }
  }

  if (!items.length) {
    return (
      <p className="text-xs text-foreground-muted">
        No prioritised actions — no exploitable findings detected.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.priority} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-acid/10 font-mono text-[10px] font-bold text-acid">
            {item.priority}
          </span>
          <div>
            <p className="text-xs font-medium text-foreground">{item.text}</p>
            {item.sub.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {item.sub.map((s, i) => (
                  <li key={i} className="text-[11px] text-foreground-muted before:mr-1.5 before:content-['–']">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  OWASPPanel                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function OWASPPanel({ coverage }: { coverage: Record<string, OWASPBucket> }) {
  const entries = Object.entries(coverage).filter(([, v]) => v.count > 0);
  if (!entries.length) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([owasp, bucket]) => (
        <div
          key={owasp}
          className="flex items-center justify-between rounded border border-white/[0.06] bg-surface px-3 py-2"
        >
          <div>
            <p className="font-mono text-[10px] text-foreground-subtle">{owasp}</p>
            <p className="text-[11px] text-foreground-muted">
              {bucket.count} finding{bucket.count !== 1 ? "s" : ""}
            </p>
          </div>
          <span
            className={cn(
              "font-mono text-sm font-bold",
              bucket.max_cvss >= 9 ? "text-threat" :
              bucket.max_cvss >= 7 ? "text-orange-400" :
              bucket.max_cvss >= 5 ? "text-amber-300" :
              "text-acid",
            )}
          >
            {bucket.max_cvss.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main FindingsReport                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

interface FindingsReportProps {
  report: ScanReport | null;
  scanStatus: string;
  scanId?: string;
  targetModel?: string;
  targetUrl?: string;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PDF Export                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHTML(
  report: ScanReport,
  scanId: string,
  targetModel: string,
  targetUrl: string,
): string {
  const findings = report.findings ?? [];
  const SEV_COLOR: Record<string, string> = {
    critical: "#dc2626",
    high: "#f97316",
    medium: "#d97706",
    low: "#84cc16",
    info: "#6b7280",
  };
  const RISK_COLOR: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#f97316",
    MEDIUM: "#d97706",
    LOW: "#84cc16",
    NONE: "#6b7280",
  };
  const riskLabel = report.risk_label ?? "NONE";
  const riskCol = RISK_COLOR[riskLabel] ?? RISK_COLOR.NONE;

  const findingsHTML = findings
    .map(
      (f) => `
    <div style="border:1px solid #e5e7eb;border-left:4px solid ${SEV_COLOR[f.severity] ?? SEV_COLOR.info};margin-bottom:20px;padding:16px;border-radius:4px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="min-width:0;flex:1">
          <span style="font-family:monospace;font-size:10px;color:#9ca3af">${f.id}</span>
          <h3 style="margin:4px 0;font-size:13px;color:#111">${escapeHTML(FAMILY_LABEL[f.family] ?? f.family ?? f.attack)}</h3>
          ${f.summary ? `<p style="margin:4px 0 0;font-size:11px;color:#6b7280">${escapeHTML(f.summary)}</p>` : ""}
          ${(f.cwe_references?.length ?? 0) > 0 ? `<div style="margin-top:6px">${f.cwe_references!.map((c) => `<span style="display:inline-block;margin-right:4px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:1px 5px;font-family:monospace;font-size:10px;color:#374151">${escapeHTML(c)}</span>`).join("")}</div>` : ""}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:16px">
          <div style="font-family:monospace;font-size:22px;font-weight:700;color:${SEV_COLOR[f.severity] ?? SEV_COLOR.info}">${f.cvss.toFixed(1)}</div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:${SEV_COLOR[f.severity] ?? SEV_COLOR.info}">${f.severity}</div>
        </div>
      </div>
      ${f.evidence ? `<div style="margin-bottom:10px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:5px">Evidence</div><pre style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px;border-radius:4px;font-size:10px;white-space:pre-wrap;word-break:break-word;font-family:monospace;margin:0">${escapeHTML(f.evidence)}</pre></div>` : ""}
      ${f.remediation ? `<div style="margin-bottom:10px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:5px">Remediation</div><div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:10px;border-radius:4px;font-size:11px">${escapeHTML(f.remediation)}</div></div>` : ""}
      <div style="font-size:10px;font-weight:600;display:inline-block;padding:2px 8px;border-radius:3px;background:${f.verdict ? "#fef2f2" : "#f0fdf4"};color:${f.verdict ? "#dc2626" : "#15803d"}">${f.verdict ? "EXPLOITED" : "MITIGATED"}</div>
    </div>`,
    )
    .join("");

  const statsRow = [
    { label: "Total Findings", val: String(findings.length) },
    {
      label: "Critical",
      val: String(findings.filter((f) => f.severity === "critical").length),
      color: "#dc2626",
    },
    {
      label: "High",
      val: String(findings.filter((f) => f.severity === "high").length),
      color: "#f97316",
    },
    { label: "Attack Vectors", val: String(report.attacks_run ?? 0) },
  ]
    .map(
      (s) =>
        `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:700;color:${s.color ?? "#111"}">${s.val}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${s.label}</div></div>`,
    )
    .join("");

  const owaspHTML = report.owasp_coverage
    ? Object.entries(report.owasp_coverage)
        .filter(([, v]) => v.count > 0)
        .map(
          ([owasp, bucket]) =>
            `<tr><td style="padding:7px;font-family:monospace;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb">${escapeHTML(owasp)}</td><td style="padding:7px;text-align:center;border-bottom:1px solid #e5e7eb">${bucket.count}</td><td style="padding:7px;text-align:right;font-family:monospace;font-weight:700;color:${bucket.max_cvss >= 9 ? "#dc2626" : bucket.max_cvss >= 7 ? "#f97316" : bucket.max_cvss >= 5 ? "#d97706" : "#84cc16"};border-bottom:1px solid #e5e7eb">${bucket.max_cvss.toFixed(1)}</td></tr>`,
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ForgeGuard AI — Security Report — ${scanId.slice(0, 8)}</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;margin:0;padding:40px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{
  body{padding:0}
  .no-print{display:none!important}
  @page{margin:20mm;size:A4}
  h2{page-break-after:avoid}
}
</style>
</head>
<body>
<div class="no-print" style="text-align:center;padding:14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;margin:-40px -40px 40px">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">⬇ Save as PDF</button>
  <span style="margin-left:12px;font-size:11px;color:#6b7280">Choose "Save as PDF" in the print dialog</span>
</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:28px">
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Security Intelligence Report</div>
    <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">ForgeGuard AI</h1>
    <div style="font-size:11px;color:#6b7280">Scan ID: <span style="font-family:monospace">${scanId}</span></div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Generated: ${new Date().toLocaleString()}</div>
  </div>
  <div style="text-align:right;flex-shrink:0;margin-left:24px">
    <div style="font-family:monospace;font-size:46px;font-weight:700;line-height:1;color:${riskCol}">${(report.cvss_overall ?? 0).toFixed(1)}</div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${riskCol}">${riskLabel} RISK</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:28px">
  <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:3px">Model</div><div style="font-family:monospace;font-size:12px">${escapeHTML(targetModel)}</div></div>
  <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:3px">Endpoint</div><div style="font-family:monospace;font-size:11px;word-break:break-all">${escapeHTML(targetUrl)}</div></div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">${statsRow}</div>

${report.executive_summary_md ? `<div style="margin-bottom:28px"><h2 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin:0 0 14px">Executive Summary</h2><div style="font-size:12px;line-height:1.65;color:#374151;white-space:pre-wrap">${escapeHTML(report.executive_summary_md.replace(/^#+\s*/gm, ""))}</div></div>` : ""}

${findings.length > 0 ? `<div style="margin-bottom:28px"><h2 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin:0 0 14px">Findings (${findings.length})</h2>${findingsHTML}</div>` : ""}

${owaspHTML ? `<div style="margin-bottom:28px"><h2 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin:0 0 14px">OWASP LLM Coverage</h2><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f9fafb"><th style="padding:7px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb">Category</th><th style="padding:7px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb">Findings</th><th style="padding:7px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb">Max CVSS</th></tr></thead><tbody>${owaspHTML}</tbody></table></div>` : ""}

<div style="margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
  <span>ForgeGuard AI · AI Red Team Security Platform</span>
  <span>CONFIDENTIAL — For authorized recipients only</span>
</div>
</body>
</html>`;
}

function DownloadReportButton({
  report,
  scanId,
  targetModel,
  targetUrl,
}: {
  report: ScanReport;
  scanId: string;
  targetModel: string;
  targetUrl: string;
}) {
  const handleDownload = () => {
    const html = buildReportHTML(report, scanId, targetModel, targetUrl);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    // Revoke after a moment so the new window has time to load
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    // If pop-ups are blocked, fall back to direct download
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `forgeguard-report-${scanId.slice(0, 8)}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-sm border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-foreground-muted transition-colors hover:border-white/[0.15] hover:text-foreground"
    >
      <Download size={11} strokeWidth={1.75} />
      Download PDF
    </button>
  );
}

export function FindingsReport({
  report,
  scanStatus,
  scanId = "unknown",
  targetModel = "",
  targetUrl = "",
}: FindingsReportProps) {
  if (scanStatus !== "sealed") {
    return null; // only render when scan is done
  }

  if (!report) {
    return (
      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface p-6 text-center">
        <AlertOctagon size={20} className="mx-auto mb-2 text-foreground-subtle" />
        <p className="text-xs text-foreground-muted">
          Report generation failed or is still processing. Refresh in a moment.
        </p>
      </div>
    );
  }

  const findings = report.findings ?? [];
  const riskCfg = RISK_LABEL_CONFIG[report.risk_label ?? "NONE"] ?? RISK_LABEL_CONFIG.NONE;

  const critCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  return (
    <div className="mt-4 space-y-4">
      {/* ── Report header ── */}
      <div className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-surface p-5">
        <ShieldAlert size={16} strokeWidth={1.5} className="shrink-0 text-foreground-subtle" />
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground">
            Intelligence Report
          </p>
          <p className="text-[11px] text-foreground-muted">
            {findings.length} findings · {report.attacks_run ?? 0} attack vectors tested
            {report.wall_seconds ? ` · ${Math.round(report.wall_seconds / 60)}m scan` : ""}
          </p>
        </div>
        <DownloadReportButton
          report={report}
          scanId={scanId}
          targetModel={targetModel}
          targetUrl={targetUrl}
        />
        {/* Overall CVSS */}
        <div className={cn("text-right", riskCfg.glow)}>
          <div className={cn("font-mono text-3xl font-bold leading-none", riskCfg.color)}>
            {(report.cvss_overall ?? 0).toFixed(1)}
          </div>
          <div className={cn("text-[9px] font-bold uppercase tracking-widest", riskCfg.color)}>
            {report.risk_label ?? "NONE"}
          </div>
        </div>
      </div>

      {/* ── Executive summary ── */}
      {report.executive_summary_md && (
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <SectionHead icon={FileText} label="Executive Summary" />
          <div className="space-y-2">
            {report.executive_summary_md.split("\n").filter(Boolean).map((line, i) => {
              if (line.startsWith("##")) {
                return (
                  <p key={i} className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
                    {line.replace(/^#+\s*/, "")}
                  </p>
                );
              }
              return (
                <p key={i} className="text-xs leading-relaxed text-foreground-muted">
                  {line.startsWith("-") ? `→ ${line.slice(1).trim()}` : line}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Findings list ── */}
      {findings.length > 0 && (
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <SectionHead icon={Target} label="Findings" />
            <div className="flex items-center gap-3 text-[10px]">
              {critCount > 0 && (
                <span className="text-threat">{critCount} CRITICAL</span>
              )}
              {highCount > 0 && (
                <span className="text-orange-400">{highCount} HIGH</span>
              )}
              <span className="text-foreground-subtle">{findings.length} total</span>
            </div>
          </div>
          <div className="space-y-2">
            {findings.map((finding, i) => (
              <FindingCard key={finding.id} finding={finding} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Remediation roadmap + OWASP side by side ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Roadmap */}
        {report.optimization_suggestions_md && (
          <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
            <SectionHead icon={ShieldCheck} label="Remediation Roadmap" />
            <RemediationRoadmap md={report.optimization_suggestions_md} />
          </div>
        )}

        {/* OWASP coverage */}
        {report.owasp_coverage &&
          Object.keys(report.owasp_coverage).length > 0 && (
            <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
              <SectionHead icon={Layers} label="OWASP LLM Coverage" />
              <OWASPPanel coverage={report.owasp_coverage} />
            </div>
          )}
      </div>
    </div>
  );
}
