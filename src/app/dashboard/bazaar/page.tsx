"use client";

/**
 * /dashboard/bazaar
 * ─────────────────────────────────────────────────────────────────────────────
 * Hacker Bazaar — Script Marketplace
 *
 * Two modes:
 *   BROWSE  — grid of published+cleared scripts, filter by lang/tag/price
 *   UPLOAD  — slide-in panel to submit a new script for AI Customs audit
 *
 * Aesthetic: Deep Sea Marineford — obsidian background, acid-green accents,
 *            sharp edges, monospaced type, no bubbly radius.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { purchaseScript } from "@/components/bazaar/actions";
import { notifyWalletRefresh } from "@/lib/wallet-events";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { fetchBazaarCatalog } from "@/lib/bazaar/fetch-catalog";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingCart, Upload, Search, Filter, Zap,
  Shield, CheckCircle, AlertTriangle, XCircle,
  Star, Code2, Tag, DollarSign, X, ChevronDown,
  Package, Terminal, Loader2, ShieldCheck, Copy, Check,
  Download, Ghost,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Script {
  id:               string;
  name:             string;
  description:      string;
  language:         string;
  tags:             string[];
  price_usd:        number;
  is_free:          boolean;
  purchase_count:   number;
  audit_verdict:    "cleared" | "flagged" | "rejected" | "pending";
  audit_risk_score: number;
  is_purchased:     boolean;
  is_certified?:    boolean;
  created_at:       string;
  author: {
    full_name: string;
    username:  string;
    rank:      string;
    is_ghost?: boolean;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  python:     "Python",
  bash:       "Bash",
  javascript: "JavaScript",
  rust:       "Rust",
};

const VERDICT_CONFIG = {
  cleared:  { label: "CLEARED",  color: "#D1FF00", icon: CheckCircle,    bg: "rgba(209,255,0,0.08)"   },
  flagged:  { label: "FLAGGED",  color: "#F59E0B", icon: AlertTriangle,  bg: "rgba(245,158,11,0.08)"  },
  rejected: { label: "REJECTED", color: "#EF4444", icon: XCircle,        bg: "rgba(239,68,68,0.08)"   },
  pending:  { label: "PENDING",  color: "#6B7280", icon: Shield,          bg: "rgba(107,114,128,0.08)" },
};

// ─── Language → file extension ───────────────────────────────────────────────
const LANG_EXT: Record<string, string> = {
  python: ".py", bash: ".sh", javascript: ".js", rust: ".rs",
};

// ─── Minimal client-side PKZIP builder (stored, no compression) ──────────────
function buildClientZip(filename: string, content: string): Uint8Array {
  const enc  = new TextEncoder();
  const data = enc.encode(content);
  const name = enc.encode(filename);

  // CRC-32 table
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    T[n] = c;
  }
  let c2 = 0xffffffff;
  for (const b of data) c2 = T[(c2 ^ b) & 0xff] ^ (c2 >>> 8);
  const crc = (c2 ^ 0xffffffff) >>> 0;

  const u16 = (v: number, a: Uint8Array, o: number) => {
    a[o] = v & 0xff; a[o + 1] = (v >> 8) & 0xff;
  };
  const u32 = (v: number, a: Uint8Array, o: number) => {
    a[o] = v & 0xff; a[o + 1] = (v >> 8) & 0xff;
    a[o + 2] = (v >> 16) & 0xff; a[o + 3] = (v >> 24) & 0xff;
  };

  // Local file header (30 + name)
  const lh = new Uint8Array(30 + name.length);
  u32(0x04034b50, lh, 0); u16(20, lh, 4);
  u32(crc, lh, 14); u32(data.length, lh, 18); u32(data.length, lh, 22);
  u16(name.length, lh, 26); lh.set(name, 30);

  // Central directory entry (46 + name)
  const cde = new Uint8Array(46 + name.length);
  u32(0x02014b50, cde, 0); u16(20, cde, 4); u16(20, cde, 6);
  u32(crc, cde, 16); u32(data.length, cde, 20); u32(data.length, cde, 24);
  u16(name.length, cde, 28); cde.set(name, 46); // offset = 0

  // End of central directory
  const eocd = new Uint8Array(22);
  u32(0x06054b50, eocd, 0);
  u16(1, eocd, 8); u16(1, eocd, 10);
  u32(cde.length, eocd, 12);
  u32(lh.length + data.length, eocd, 16);

  const zip = new Uint8Array(lh.length + data.length + cde.length + eocd.length);
  let pos = 0;
  zip.set(lh, pos); pos += lh.length;
  zip.set(data, pos); pos += data.length;
  zip.set(cde, pos); pos += cde.length;
  zip.set(eocd, pos);
  return zip;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ForgeGuardCertifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] uppercase"
      style={{
        color: "#D1FF00",
        background: "rgba(209,255,0,0.12)",
        border: "1px solid rgba(209,255,0,0.35)",
      }}
      title="ForgeGuard Certified — admin-verified script"
    >
      <ShieldCheck size={10} strokeWidth={2} />
      ForgeGuard Certified
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: Script["audit_verdict"] }) {
  const cfg  = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-widest uppercase"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function RiskMeter({ score }: { score: number }) {
  const color =
    score >= 80 ? "#EF4444" :
    score >= 50 ? "#F59E0B" :
    "#D1FF00";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 flex-1 rounded-none" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[10px]" style={{ color }}>{score}</span>
    </div>
  );
}

function LangDot({ lang }: { lang: string }) {
  const colors: Record<string, string> = {
    python: "#3B82F6", bash: "#10B981", javascript: "#F59E0B", rust: "#EF4444",
  };
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#9CA3AF]">
      <span className="size-2 rounded-full" style={{ background: colors[lang] ?? "#6B7280" }} />
      {LANG_LABELS[lang] ?? lang}
    </span>
  );
}

function ScriptCard({
  script,
  onPurchase,
  purchasing,
}: {
  script:    Script;
  onPurchase: (id: string) => void;
  purchasing: string | null;
}) {
  const isBuying = purchasing === script.id;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group relative flex flex-col"
      style={{
        background: "#0A0A0A",
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "border-color 0.2s",
      }}
      whileHover={{ borderColor: "rgba(209,255,0,0.25)" }}
    >
      {/* Accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background:
            script.audit_risk_score >= 80 ? "#EF4444" :
            script.audit_risk_score >= 50 ? "#F59E0B" :
            "#D1FF00",
        }}
      />

      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal size={14} className="shrink-0 text-[#D1FF00]" />
            <span className="font-mono text-[13px] font-semibold text-white truncate">
              {script.name}
            </span>
            {script.is_certified && <ForgeGuardCertifiedBadge />}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {script.audit_risk_score <= 10 && !script.is_certified && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest uppercase"
                style={{
                  color: "#D1FF00",
                  background: "rgba(209,255,0,0.07)",
                  border: "1px solid rgba(209,255,0,0.35)",
                }}
                title="Verified by ForgeGuard AI — Risk Score ≤ 10"
              >
                <ShieldCheck size={10} strokeWidth={2} />
                Verified
              </span>
            )}
            <VerdictBadge verdict={script.audit_verdict} />
          </div>
        </div>

        {/* Description */}
        <p className="text-[12px] leading-relaxed text-[#6B7280] line-clamp-2">
          {script.description}
        </p>

        {/* Risk meter */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#4B5563] uppercase tracking-widest">Risk Score</span>
          </div>
          <RiskMeter score={script.audit_risk_score} />
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between text-[11px]">
          <LangDot lang={script.language} />
          <div className="flex items-center gap-3 text-[#4B5563]">
            <span className="flex items-center gap-1">
              <ShoppingCart size={10} />
              {script.purchase_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[#6B7280]">
              {script.author?.is_ghost ? (
                <>
                  <Ghost size={10} style={{ color: "#4A4A4A" }} />
                  <span style={{ color: "#4A4A4A" }}>
                    {script.author.username}
                  </span>
                </>
              ) : (
                script.author?.username ?? "anon"
              )}
            </span>
          </div>
        </div>

        {/* Tags */}
        {script.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {script.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6B7280" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          disabled={script.is_purchased || isBuying}
          onClick={() => !script.is_purchased && onPurchase(script.id)}
          className="mt-1 flex w-full items-center justify-center gap-2 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:cursor-default"
          style={
            script.is_purchased
              ? { background: "rgba(209,255,0,0.06)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.2)" }
              : { background: "rgba(209,255,0,0.08)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }
          }
        >
          {isBuying ? (
            <><Loader2 size={12} className="animate-spin" />Processing…</>
          ) : script.is_purchased ? (
            <><CheckCircle size={12} />Owned — View Code</>
          ) : script.is_free ? (
            <><Zap size={12} />Free — Acquire</>
          ) : (
            <><DollarSign size={12} />${script.price_usd.toFixed(2)} — Purchase</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Code Viewer Modal ────────────────────────────────────────────────────────

function CodeViewerModal({
  scriptName,
  code,
  language,
  onClose,
}: {
  scriptName: string;
  code:       string;
  language:   string;
  onClose:    () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleDownloadZip = () => {
    const ext      = LANG_EXT[language] ?? ".txt";
    const filename = `${scriptName}${ext}`;
    const zip      = buildClientZip(filename, code);
    const blob = new Blob([zip as BlobPart], { type: "application/zip" });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement("a");
    a.href         = url;
    a.download     = `${scriptName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="fixed inset-x-4 top-[10%] z-[51] mx-auto flex max-h-[80vh] max-w-3xl flex-col"
        style={{ background: "#070707", border: "1px solid rgba(209,255,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[#D1FF00]" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-widest text-white">
              {scriptName}
            </span>
            <span
              className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
              style={{ color: "#D1FF00", background: "rgba(209,255,0,0.08)", border: "1px solid rgba(209,255,0,0.2)" }}
            >
              Acquired
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all"
              style={{
                color:      "#D1FF00",
                border:     "1px solid rgba(209,255,0,0.25)",
                background: "rgba(209,255,0,0.05)",
              }}
            >
              <Download size={10} />
              ZIP
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all"
              style={{
                color:   copied ? "#D1FF00" : "#9CA3AF",
                border:  `1px solid ${copied ? "rgba(209,255,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                background: copied ? "rgba(209,255,0,0.06)" : "transparent",
              }}
            >
              {copied ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#4B5563] transition-colors hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Code area */}
        <div className="flex-1 overflow-auto">
          <pre
            className="p-5 font-mono text-[12px] leading-relaxed text-[#D1FF00] whitespace-pre-wrap break-all"
            style={{ background: "#050505", minHeight: "200px" }}
          >
            {code}
          </pre>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <Shield size={11} className="text-[#4B5563]" />
          <span className="font-mono text-[10px] text-[#4B5563]">
            Cleared by AI Customs · For authorised red team use only
          </span>
        </div>
      </motion.div>
    </>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

function UploadPanel({ onClose }: { onClose: () => void }) {
  const [form, setForm] = React.useState({
    name: "", description: "", language: "python", tags: "", code: "", price_usd: "0",
  });
  const [uploading, setUploading]   = React.useState(false);
  const [result, setResult]         = React.useState<null | { verdict: string; risk_score: number; reason: string }>(null);
  const [error, setError]           = React.useState<string | null>(null);

  const submit = async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/bazaar/upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          tags:      form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          price_usd: Number(form.price_usd),
        }),
      });
      const data = await res.json() as { ok: boolean; audit?: { verdict: string; risk_score: number; reason: string }; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data.audit ?? { verdict: "cleared", risk_score: 0, reason: "Cleared by AI Customs." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const verdictColor =
    result?.verdict === "cleared"  ? "#D1FF00" :
    result?.verdict === "flagged"  ? "#F59E0B" :
    result?.verdict === "rejected" ? "#EF4444" : "#6B7280";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col"
      style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-[#D1FF00]" />
          <span className="font-mono text-[13px] font-semibold uppercase tracking-widest text-white">
            Upload to Bazaar
          </span>
        </div>
        <button onClick={onClose} className="text-[#4B5563] hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {result ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-4 p-5"
            style={{ background: "#0A0A0A", border: `1px solid ${verdictColor}40` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="size-10 flex items-center justify-center text-lg"
                style={{ background: `${verdictColor}15`, color: verdictColor }}
              >
                {result.verdict === "cleared" ? "✓" : result.verdict === "flagged" ? "!" : "✗"}
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: verdictColor }}>
                  AI Customs — {String(result.verdict ?? "pending").toUpperCase()}
                </p>
                <p className="font-mono text-[13px] font-semibold text-white">
                  Risk Score: {result.risk_score}/100
                </p>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-[#9CA3AF]">{result.reason}</p>
            {result.verdict !== "rejected" && (
              <p className="font-mono text-[11px] text-[#D1FF00]">
                {result.verdict === "cleared"
                  ? "Script published to Bazaar. Operatives can now acquire it."
                  : "Script queued for admin review before publishing."}
              </p>
            )}
          </motion.div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Script Name</label>
              <input
                className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="sql-blindfire"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Description</label>
              <textarea
                rows={2}
                className="w-full resize-none bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="What does this script do?"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Language</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-transparent px-3 py-2 font-mono text-[13px] text-white focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    value={form.language}
                    onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                  >
                    <option value="python" className="bg-[#0A0A0A]">Python</option>
                    <option value="bash"   className="bg-[#0A0A0A]">Bash</option>
                    <option value="javascript" className="bg-[#0A0A0A]">JavaScript</option>
                    <option value="rust"   className="bg-[#0A0A0A]">Rust</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Price (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  placeholder="0.00"
                  value={form.price_usd}
                  onChange={(e) => setForm((p) => ({ ...p, price_usd: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Tags (comma-separated)</label>
              <input
                className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="sqli, bypass, automation"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Script Code</label>
              <textarea
                rows={12}
                className="w-full resize-none bg-transparent px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-[#374151] focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#050505" }}
                placeholder="# Paste your script here…"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                spellCheck={false}
              />
            </div>

            <div
              className="flex items-start gap-2 px-3 py-3 text-[11px]"
              style={{ background: "rgba(209,255,0,0.04)", border: "1px solid rgba(209,255,0,0.12)" }}
            >
              <Shield size={12} className="mt-0.5 shrink-0 text-[#D1FF00]" />
              <p className="leading-relaxed text-[#9CA3AF]">
                All scripts are scanned by{" "}
                <span className="text-[#D1FF00]">AI Customs (Scout tier)</span> for Traitor logic —
                code that targets ForgeGuard infrastructure. Violations are permanently rejected.
              </p>
            </div>

            {error && (
              <div
                className="px-3 py-2 font-mono text-[12px] text-[#EF4444]"
                style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!result && (
        <div
          className="px-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            disabled={uploading || !form.name || !form.code}
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
          >
            {uploading ? (
              <><Loader2 size={12} className="animate-spin" />Running AI Customs…</>
            ) : (
              <><Upload size={12} />Submit to AI Customs</>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BazaarPage() {
  const [scripts, setScripts]         = React.useState<Script[]>([]);
  const [certifiedScripts, setCertifiedScripts] = React.useState<Script[]>([]);
  const [loadError, setLoadError]       = React.useState<string | null>(null);
  const [catalogFallback, setCatalogFallback] = React.useState(false);
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null);
  const [loading, setLoading]         = React.useState(true);
  const [search, setSearch]           = React.useState("");
  const [filterLang, setFilterLang]   = React.useState("all");
  const [filterFree, setFilterFree]   = React.useState(false);
  const [uploading, setUploading]     = React.useState(false);
  const [purchasing, setPurchasing]   = React.useState<string | null>(null);
  const [showUpload, setShowUpload]   = React.useState(false);
  const [canUpload, setCanUpload]     = React.useState(false);
  const [acquiredCode, setAcquiredCode] = React.useState<{ scriptName: string; code: string; language: string } | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (isSovereignOperator(user.email)) {
        setCanUpload(true);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("access_level")
        .eq("id", user.id)
        .maybeSingle();
      setCanUpload((profile?.access_level ?? 1) >= 2);
    })();
  }, []);

  // Load scripts from API (Bypass-Native — certified fallback on failure)
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setCatalogFallback(false);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (filterLang !== "all") params.set("lang", filterLang);
        if (filterFree) params.set("free", "true");

        const certParams = new URLSearchParams({ certified: "1", limit: "5" });
        const [data, certData] = await Promise.all([
          fetchBazaarCatalog(params),
          fetchBazaarCatalog(certParams),
        ]);

        if (data.ok) {
          setScripts((data.scripts ?? []) as Script[]);
          setCatalogFallback(Boolean(data.fallback));
          setLoadError(null);
        } else {
          setScripts([]);
          setCatalogFallback(false);
          setLoadError(data.error ?? "Could not load marketplace scripts.");
        }

        if (certData.ok) {
          setCertifiedScripts((certData.scripts ?? []) as Script[]);
        }
      } catch {
        setScripts([]);
        setLoadError("Network error loading Bazaar.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filterLang, filterFree]);

  const handlePurchase = async (scriptId: string) => {
    setPurchasing(scriptId);
    setPurchaseError(null);
    try {
      const data = await purchaseScript(scriptId);
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      if (data.ok) {
        const script = scripts.find((s) => s.id === scriptId);
        setScripts((prev) =>
          prev.map((s) => s.id === scriptId ? { ...s, is_purchased: true } : s)
        );
        if (typeof data.new_balance === "number") {
          notifyWalletRefresh(data.new_balance);
        } else {
          notifyWalletRefresh();
        }
        if (data.code && script) {
          setAcquiredCode({ scriptName: script.name, code: data.code, language: script.language });
        }
      } else {
        setPurchaseError(data.error ?? "Purchase failed.");
      }
    } catch {
      setPurchaseError("Purchase failed. Try again.");
    } finally {
      setPurchasing(null);
    }
  };

  const certifiedIds = new Set(certifiedScripts.map((s) => s.id));

  const filtered = scripts.filter((s) => {
    if (certifiedIds.has(s.id)) return false;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.includes(q))
    );
  });

  const stats = {
    total:   scripts.length,
    free:    scripts.filter((s) => s.is_free).length,
    cleared: scripts.filter((s) => s.audit_verdict === "cleared").length,
  };

  return (
    <div className="min-h-screen" style={{ background: "#050505" }}>
      {/* Code viewer modal */}
      <AnimatePresence>
        {acquiredCode && (
          <CodeViewerModal
            scriptName={acquiredCode.scriptName}
            code={acquiredCode.code}
            language={acquiredCode.language}
            onClose={() => setAcquiredCode(null)}
          />
        )}
      </AnimatePresence>

      {/* Upload panel overlay */}
      <AnimatePresence>
        {showUpload && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
              onClick={() => setShowUpload(false)}
            />
            <UploadPanel onClose={() => setShowUpload(false)} />
          </>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div
        className="px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package size={18} className="text-[#D1FF00]" />
                <h1 className="font-mono text-xl font-bold tracking-tight text-white">
                  HACKER BAZAAR
                </h1>
                <span
                  className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                  style={{ background: "rgba(209,255,0,0.08)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.2)" }}
                >
                  v1.0 Live
                </span>
              </div>
              <p className="font-mono text-[12px] text-[#4B5563]">
                AI-audited script marketplace. All uploads screened by Customs Agent.
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
              disabled={!canUpload}
              title={
                canUpload
                  ? "Submit a script for AI Customs audit"
                  : "Rank 2+ required to upload scripts"
              }
            >
              <Upload size={13} />
              Upload Script
            </button>
          </div>

          {(loadError || purchaseError) && (
            <div className="mt-4 rounded-[3px] border border-red-400/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-300">
              {purchaseError ?? loadError}
            </div>
          )}

          {catalogFallback && !loadError && (
            <div className="mt-4 rounded-[3px] border border-[#D1FF00]/30 bg-[#D1FF00]/5 px-3 py-2 font-mono text-[11px] text-[#D1FF00]">
              Bypass-Native mode — showing Certified scripts only while full catalog recovers.
            </div>
          )}

          {/* Stats bar */}
          <div className="mt-4 flex items-center gap-6">
            {[
              { label: "Scripts",  value: stats.total,   icon: Code2 },
              { label: "Free",     value: stats.free,    icon: Zap },
              { label: "Cleared",  value: stats.cleared, icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={12} className="text-[#D1FF00]" />
                <span className="font-mono text-[13px] font-semibold text-white">{value}</span>
                <span className="font-mono text-[11px] text-[#4B5563]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="sticky top-0 z-10 px-6 py-3"
        style={{ background: "rgba(5,5,5,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {/* Search */}
          <div
            className="relative flex flex-1 items-center"
            style={{ border: "1px solid rgba(255,255,255,0.08)", maxWidth: 320 }}
          >
            <Search size={13} className="absolute left-3 text-[#4B5563]" />
            <input
              className="w-full bg-transparent py-2 pl-9 pr-3 font-mono text-[12px] text-white placeholder:text-[#374151] focus:outline-none"
              placeholder="Search scripts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Language filter */}
          <div className="relative">
            <select
              className="appearance-none bg-transparent py-2 pl-3 pr-8 font-mono text-[11px] text-[#9CA3AF] focus:outline-none cursor-pointer"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
            >
              <option value="all"        className="bg-[#0A0A0A]">All Languages</option>
              <option value="python"     className="bg-[#0A0A0A]">Python</option>
              <option value="bash"       className="bg-[#0A0A0A]">Bash</option>
              <option value="javascript" className="bg-[#0A0A0A]">JavaScript</option>
              <option value="rust"       className="bg-[#0A0A0A]">Rust</option>
            </select>
            <ChevronDown size={10} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
          </div>

          {/* Free toggle */}
          <button
            onClick={() => setFilterFree((p) => !p)}
            className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-all"
            style={{
              border: "1px solid",
              borderColor: filterFree ? "rgba(209,255,0,0.4)" : "rgba(255,255,255,0.08)",
              color:       filterFree ? "#D1FF00" : "#6B7280",
              background:  filterFree ? "rgba(209,255,0,0.06)" : "transparent",
            }}
          >
            <Zap size={11} />
            Free Only
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {certifiedScripts.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#D1FF00]" />
              <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-[#D1FF00]">
                ForgeGuard Certified
              </h2>
            </div>
            <motion.div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
              layout
            >
              {certifiedScripts.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={{ ...script, is_certified: true }}
                  onPurchase={handlePurchase}
                  purchasing={purchasing}
                />
              ))}
            </motion.div>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-[#D1FF00]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Package size={32} className="mb-3 text-[#1F2937]" />
            <p className="font-mono text-[13px] text-[#374151]">No scripts match your filters.</p>
          </div>
        ) : (
          <motion.div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
            layout
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onPurchase={handlePurchase}
                  purchasing={purchasing}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
