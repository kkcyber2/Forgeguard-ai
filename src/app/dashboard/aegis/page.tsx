"use client";

/**
 * /dashboard/aegis — Aegis Defense — Universal Rule Export
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts findings from any completed scan into production-ready WAF rules
 * across three deployment targets:
 *
 *   1. Cloudflare WAF JSON     — import directly into CF Firewall Rules
 *   2. Python / FastAPI ASGI   — drop-in middleware for Starlette / Django
 *   3. Next.js TypeScript      — edge middleware.ts for App Router projects
 *
 * Aesthetic: Cold Obsidian + Acid Green, consistent with the rest of the
 * Stronghold shell.
 */

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileCode,
  FileJson,
  Loader2,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = "cloudflare" | "python" | "nextjs";

interface ExportResponse {
  ok:       boolean;
  format:   ExportFormat;
  ruleset?: unknown;       // cloudflare
  code?:    string;        // python / nextjs
  error?:   string;
}

// ─── Format config ────────────────────────────────────────────────────────────

const FORMATS: {
  id:          ExportFormat;
  label:       string;
  sublabel:    string;
  icon:        React.ElementType;
  ext:         string;
  mime:        string;
  filename:    string;
  description: string;
  category:    "infrastructure" | "logic";
}[] = [
  {
    id:          "cloudflare",
    label:       "Cloudflare WAF",
    sublabel:    "JSON ruleset",
    icon:        FileJson,
    ext:         "json",
    mime:        "application/json",
    filename:    "forgeguard-aegis-cloudflare.json",
    description: "Import directly into Cloudflare Firewall Rules via the API or Dashboard.",
    category:    "infrastructure",
  },
  {
    id:          "python",
    label:       "FastAPI / Django",
    sublabel:    "Python ASGI middleware",
    icon:        FileCode,
    ext:         "py",
    mime:        "text/x-python",
    filename:    "aegis_middleware.py",
    description: "Drop-in ASGI middleware for Starlette, FastAPI, or Django apps.",
    category:    "infrastructure",
  },
  {
    id:          "nextjs",
    label:       "Next.js Edge",
    sublabel:    "TypeScript middleware",
    icon:        Code2,
    ext:         "ts",
    mime:        "text/typescript",
    filename:    "middleware.ts",
    description: "Place at your project root — Edge runtime blocks injections before route handlers.",
    category:    "logic",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  infrastructure: {
    label:       "Infrastructure",
    description: "Network-layer rules for Cloudflare, AWS WAF, and ASGI servers",
  },
  logic: {
    label:       "Logic",
    description: "Application-layer rules for JS/TypeScript and malware pattern detection",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function codeFromResponse(resp: ExportResponse): string {
  if (resp.code) return resp.code;
  if (resp.ruleset) return JSON.stringify(resp.ruleset, null, 2);
  return "";
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Code preview ─────────────────────────────────────────────────────────────

function CodePreview({ code, ext }: { code: string; ext: string }) {
  const [copied, setCopied] = React.useState(false);
  const lines = code.split("\n");

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative rounded-xs border border-white/[0.06] bg-obsidian-900/70 overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
          .{ext}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-foreground-subtle">
            {lines.length} lines
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-xs border border-white/[0.06] bg-obsidian-800/40 px-2 py-1 font-mono text-[10px] text-foreground-muted hover:text-foreground transition-colors"
          >
            {copied
              ? <CheckCircle2 size={9} strokeWidth={1.5} className="text-acid" />
              : <Copy size={9} strokeWidth={1.5} />
            }
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* code */}
      <pre className="max-h-[480px] overflow-auto px-4 py-4 font-mono text-[11px] leading-relaxed text-foreground-muted scrollbar-thin scrollbar-thumb-white/10">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-4">
            <span className="w-8 shrink-0 select-none text-right text-foreground-subtle/40 tabular-nums">
              {i + 1}
            </span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AegisPage() {
  const reduce = useReducedMotion();

  const [scanId,         setScanId]         = React.useState("");
  const [format,         setFormat]         = React.useState<ExportFormat>("cloudflare");
  const [loading,        setLoading]        = React.useState(false);
  const [result,         setResult]         = React.useState<ExportResponse | null>(null);
  const [error,          setError]          = React.useState<string | null>(null);
  const [expandInfo,     setExpandInfo]     = React.useState(false);
  const [bundleLoading,  setBundleLoading]  = React.useState(false);
  const [bundleError,    setBundleError]    = React.useState<string | null>(null);

  const selectedFmt = FORMATS.find((f) => f.id === format)!;
  const code        = result ? codeFromResponse(result) : "";
  const canExport   = isValidUuid(scanId);

  async function handleExport() {
    if (!canExport || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/aegis/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scan_id: scanId.trim(), format }),
      });

      const json = (await res.json()) as ExportResponse;

      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }

      setResult(json);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!code) return;
    downloadFile(code, selectedFmt.filename, selectedFmt.mime);
  }

  async function handleDownloadBundle() {
    if (!canExport || bundleLoading) return;
    setBundleLoading(true);
    setBundleError(null);
    try {
      const res = await fetch("/api/aegis/export-bundle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scan_id: scanId.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setBundleError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `aegis-bundle-${scanId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setBundleError((err as Error).message ?? "Download failed");
    } finally {
      setBundleLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} strokeWidth={1.5} className="text-acid" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
            Aegis Defense
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Universal Rule Export
        </h1>
        <p className="max-w-xl text-sm text-foreground-muted">
          Convert scan findings into production-ready WAF rules. Deploy to
          Cloudflare, FastAPI, or Next.js in seconds.
        </p>
      </motion.div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: "Export targets", value: "3 platforms", icon: Zap,        tone: "acid"    },
          { label: "Rule engine",    value: "CVSS 4.0",    icon: ShieldCheck, tone: "secure"  },
          { label: "Deploy time",    value: "< 60 seconds",icon: FileJson,    tone: "neutral" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-obsidian-800/40 px-4 py-3"
          >
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-xs border",
              tone === "acid" || tone === "secure"
                ? "border-acid/20 bg-acid/[0.06]"
                : "border-white/[0.06] bg-obsidian-700/40",
            )}>
              <Icon size={12} strokeWidth={1.5} className={cn(
                tone === "acid" || tone === "secure" ? "text-acid" : "text-foreground-muted",
              )} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{value}</p>
              <p className="text-[11px] text-foreground-muted">{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls sidebar */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-col gap-5"
        >
          {/* Scan ID input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
              Scan ID
            </label>
            <input
              type="text"
              value={scanId}
              onChange={(e) => {
                setScanId(e.target.value);
                setResult(null);
                setError(null);
              }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              maxLength={36}
              className={cn(
                "w-full rounded-xs border bg-obsidian-800/60",
                "px-3 py-2 font-mono text-[12px] text-foreground placeholder:text-foreground-subtle",
                "focus:outline-none focus:ring-0 transition-colors",
                canExport
                  ? "border-acid/30 focus:border-acid/50"
                  : "border-white/[0.08] focus:border-white/[0.18]",
              )}
            />
            {scanId && !canExport && (
              <p className="text-[10px] text-amber-400 font-mono">
                Enter a valid UUID from a completed scan.
              </p>
            )}
          </div>

          {/* Format selector — grouped by category */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              Export format
            </span>
            <div className="flex flex-col gap-4">
              {(["infrastructure", "logic"] as const).map((cat) => {
                const catFmts = FORMATS.filter((f) => f.category === cat);
                const catMeta = CATEGORY_LABELS[cat];
                return (
                  <div key={cat} className="flex flex-col gap-2">
                    {/* Category header */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400">
                        {catMeta.label}
                      </span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                    </div>
                    <p className="text-[10px] text-zinc-400 -mt-1 mb-1">
                      {catMeta.description}
                    </p>
                    {catFmts.map((fmt) => {
                      const Icon   = fmt.icon;
                      const active = format === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          onClick={() => { setFormat(fmt.id); setResult(null); setError(null); }}
                          className={cn(
                            "flex items-start gap-3 rounded-xs border px-4 py-3 text-left transition-all",
                            active
                              ? "border-acid/30 bg-acid/[0.06]"
                              : "border-white/[0.06] bg-obsidian-800/30 hover:border-white/[0.12]",
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border",
                            active ? "border-acid/30 bg-acid/[0.10]" : "border-white/[0.08] bg-obsidian-700/40",
                          )}>
                            <Icon size={11} strokeWidth={1.5} className={active ? "text-acid" : "text-zinc-400"} />
                          </div>
                          <div>
                            <p className={cn(
                              "text-[12px] font-medium leading-none",
                              active ? "text-acid" : "text-zinc-300",
                            )}>
                              {fmt.label}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-zinc-400">
                              {fmt.sublabel}
                            </p>
                            <p className="mt-1.5 text-[11px] text-zinc-400 leading-snug">
                              {fmt.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => void handleExport()}
            disabled={!canExport || loading}
            className={cn(
              "flex items-center justify-center gap-2 rounded-sm border px-6 py-2.5 text-sm font-medium transition-all duration-150",
              "border-acid/30 bg-acid/[0.07] text-acid",
              "hover:bg-acid/[0.12] disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {loading ? (
              <>
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                Generating rules…
              </>
            ) : (
              <>
                <ShieldCheck size={13} strokeWidth={1.5} />
                Generate {selectedFmt.label} rules
              </>
            )}
          </button>

          {/* Download Bundle (.zip) */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => void handleDownloadBundle()}
              disabled={!canExport || bundleLoading}
              className={cn(
                "flex items-center justify-center gap-2 rounded-sm border px-6 py-2.5 text-sm font-medium transition-all duration-150",
                "border-steel-600/40 bg-obsidian-800/40 text-foreground-muted",
                "hover:border-acid/20 hover:text-acid hover:bg-acid/[0.04]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {bundleLoading ? (
                <>
                  <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                  Packaging bundle…
                </>
              ) : (
                <>
                  <Archive size={13} strokeWidth={1.5} />
                  Download Bundle (.zip)
                </>
              )}
            </button>
            <p className="text-center font-mono text-[9px] text-foreground-subtle">
              All 3 formats · cloudflare_waf.json · python_middleware.py · nextjs_shield.ts
            </p>
            {bundleError && (
              <p className="flex items-center gap-1.5 font-mono text-[10px] text-threat">
                <AlertTriangle size={9} strokeWidth={1.5} />
                {bundleError}
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-sm border border-white/[0.04] bg-obsidian-800/20 px-4 py-4">
            <button
              onClick={() => setExpandInfo((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
                How it works
              </p>
              {expandInfo
                ? <ChevronDown size={11} strokeWidth={1.5} className="text-foreground-subtle" />
                : <ChevronRight size={11} strokeWidth={1.5} className="text-foreground-subtle" />
              }
            </button>
            <AnimatePresence>
              {expandInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-col gap-2">
                    {[
                      "Findings fetched from completed scan",
                      "Attack techniques mapped to block patterns",
                      "Rules persisted to aegis_rules for Bounty cross-ref",
                      "Download and deploy in 60 seconds",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="mt-px font-mono text-[10px] text-acid shrink-0">{i + 1}.</span>
                        <p className="text-[11px] text-foreground-subtle leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Output panel */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="flex flex-col gap-4"
        >
          {/* Output header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson size={12} strokeWidth={1.5} className="text-foreground-muted" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                Generated output
              </span>
            </div>
            {result && code && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-xs border border-acid/20 bg-acid/[0.05] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-acid hover:bg-acid/[0.10] transition-colors"
              >
                <Download size={9} strokeWidth={1.5} />
                Download .{selectedFmt.ext}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Error state */}
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 rounded-xs border border-threat/30 bg-threat/[0.07] px-4 py-3"
              >
                <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-threat" />
                <p className="text-sm text-threat">{error}</p>
              </motion.div>
            )}

            {/* Loading state */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 rounded-sm border border-white/[0.05] bg-obsidian-900/40 px-6 py-24 text-center"
              >
                <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-acid" />
                <p className="text-sm text-foreground-muted">Generating {selectedFmt.label} rules…</p>
              </motion.div>
            )}

            {/* Result */}
            {result && !loading && code && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {/* Success banner */}
                <div className="flex items-center gap-3 rounded-xs border border-acid/20 bg-acid/[0.05] px-4 py-2.5">
                  <ShieldCheck size={13} strokeWidth={1.5} className="text-acid" />
                  <p className="text-[12px] text-acid">
                    <span className="font-semibold">{selectedFmt.label}</span> rules generated —
                    rules saved to <span className="font-mono">aegis_rules</span>.
                  </p>
                </div>

                <CodePreview code={code} ext={selectedFmt.ext} />
              </motion.div>
            )}

            {/* Idle state */}
            {!result && !loading && !error && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 rounded-sm border border-white/[0.05] bg-obsidian-900/40 px-6 py-24 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xs border border-white/[0.06] bg-obsidian-800/60">
                  <Shield size={16} strokeWidth={1.5} className="text-foreground-subtle" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-muted">
                    No rules generated yet
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
                    Enter a scan ID and select a format
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
