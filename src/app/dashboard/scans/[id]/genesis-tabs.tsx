"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  GitBranch,
  DollarSign,
  Shield,
  Users,
  ChevronRight,
  Circle,
  AlertTriangle,
  ExternalLink,
  Brain,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ApiEndpoint { path: string; method: string; source: string }
export interface InputVector  { url: string; param: string; type: string }

export interface DiscoveryReport {
  pages_crawled: number;
  api_endpoints: ApiEndpoint[];
  input_vectors: InputVector[];
  crawl_errors: string[];
  base_url: string;
}

export interface SocialTemplate {
  template_id: string;
  category: string;
  platform: string;
  subject: string;
  content: string;
  red_flags: string[];
  training_debrief: string;
  watermark: string;
}

export interface AgentMemoryRow {
  id: string;
  agent_role: string | null;
  thought: string;
  action_taken: string | null;
  created_at: string | null;
}

export interface GenesisTabs {
  scanId: string;
  targetUrl: string;
  scanIntensity?: "recon" | "standard" | "aggressive" | "greasy";
  scanStatus?: string;
  discoveryReport: DiscoveryReport | null;
  aleUsd: number | null;
  telemetryTrend?: number[];
  socialTemplates: SocialTemplate[] | null;
  aegisZipB64: string | null;
  agentMemories?: AgentMemoryRow[] | null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Tab identifiers                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

type TabKey = "recon" | "finance" | "aegis" | "social" | "memories";

const ALL_TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "recon",   label: "RECON MAP",     icon: GitBranch  },
  { key: "finance", label: "FINANCIAL RISK", icon: DollarSign },
  { key: "aegis",   label: "AEGIS BUNDLE",  icon: Shield     },
  { key: "social",  label: "SOCIAL SWARM",  icon: Users      },
  { key: "memories", label: "AGENT_MEMORIES", icon: Brain   },
];

function tabsForIntensity(intensity: GenesisTabs["scanIntensity"]): TabKey[] {
  const level = intensity ?? "standard";
  const keys: TabKey[] = ["recon", "finance"];
  if (level === "aggressive" || level === "greasy") keys.push("aegis");
  if (level === "greasy") {
    keys.push("social", "memories");
  }
  return keys;
}

function formatAleDisplay(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function GenesisTabs({
  scanId,
  targetUrl,
  scanIntensity = "standard",
  scanStatus,
  discoveryReport,
  aleUsd,
  telemetryTrend,
  socialTemplates,
  aegisZipB64,
  agentMemories,
}: GenesisTabs) {
  const visibleKeys = tabsForIntensity(scanIntensity);
  const TABS = ALL_TABS.filter((t) => visibleKeys.includes(t.key));
  const [active, setActive] = React.useState<TabKey>(visibleKeys[0] ?? "recon");

  React.useEffect(() => {
    if (!visibleKeys.includes(active)) {
      setActive(visibleKeys[0] ?? "recon");
    }
  }, [active, visibleKeys]);

  const hasData =
    discoveryReport != null ||
    aleUsd != null ||
    (socialTemplates != null && socialTemplates.length > 0) ||
    aegisZipB64 != null ||
    (agentMemories != null && agentMemories.length > 0);
  if (!hasData) return null;

  return (
    <section className="mt-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-acid">
          ◆ Genesis Intelligence
        </span>
        <div className="h-[0.5px] flex-1 bg-white/[0.06]" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-px overflow-x-auto rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={[
              "relative flex min-w-max items-center gap-2 rounded-[3px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-all duration-150",
              active === t.key
                ? "bg-acid/[0.1] text-acid shadow-[0_0_12px_rgba(209,255,0,0.08)]"
                : "text-foreground-muted hover:text-foreground",
            ].join(" ")}
          >
            <t.icon size={10} strokeWidth={1.75} />
            {t.label}
            {active === t.key && (
              <motion.span
                layoutId="genesis-tab-indicator"
                className="absolute inset-0 rounded-[3px] border-[0.5px] border-acid/30"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="mt-3 rounded-sm border-[0.5px] border-white/[0.06] bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          {active === "recon"   && <ReconMap    report={discoveryReport} targetUrl={targetUrl} />}
          {active === "finance" && (
            <FinancialRisk
              aleUsd={aleUsd}
              scanSealed={scanStatus === "sealed"}
              telemetryTrend={telemetryTrend}
            />
          )}
          {active === "aegis"   && <AegisBundle scanId={scanId} zipB64={aegisZipB64} />}
          {active === "social"  && <SocialSwarm templates={socialTemplates} />}
          {active === "memories" && <AgentMemoriesPanel memories={agentMemories} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* RECON MAP panel                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-[#4ade80]",
  POST:   "text-acid",
  PUT:    "text-[#60a5fa]",
  DELETE: "text-[#f87171]",
  PATCH:  "text-[#c084fc]",
};

function ReconMap({ report, targetUrl }: { report: DiscoveryReport | null; targetUrl: string }) {
  if (!report) {
    return <EmptyState label="Discovery engine output not yet available." icon={GitBranch} />;
  }

  const domain = report.base_url || targetUrl;
  const endpoints = (report.api_endpoints ?? []).slice(0, 40);
  const vectors   = (report.input_vectors ?? []).slice(0, 20);
  const crawlErrors = report.crawl_errors ?? [];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pages crawled",  value: report.pages_crawled },
          { label: "API endpoints",  value: (report.api_endpoints ?? []).length },
          { label: "Input vectors",  value: (report.input_vectors ?? []).length },
          { label: "Crawl errors",   value: crawlErrors.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[3px] border-[0.5px] border-white/[0.06] bg-white/[0.02] p-3"
          >
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {s.value}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-foreground-subtle">{s.label}</p>
          </div>
        ))}
      </div>

      {/* SVG tree */}
      <div className="overflow-x-auto">
        <svg width="100%" height={Math.max(160, Math.min(endpoints.length * 28 + 80, 480))} className="font-mono text-[10px]">
          {/* Root node */}
          <g transform="translate(16, 32)">
            <rect x={0} y={-10} width={200} height={22} rx={3} fill="rgba(209,255,0,0.06)" stroke="rgba(209,255,0,0.25)" strokeWidth={0.5} />
            <text fill="rgba(209,255,0,0.9)" fontSize={10} x={8} y={6}>{domain.slice(0, 28)}</text>
          </g>

          {/* Endpoint branches */}
          {endpoints.map((ep, i) => {
            const y = 32 + 28 + i * 26;
            const methodClass =
              METHOD_COLOR[String(ep.method ?? "").toUpperCase()] ||
              "text-foreground-muted";
            const methodFill = ep.method === "GET" ? "#4ade80" : ep.method === "POST" ? "#d1ff00" :
              ep.method === "DELETE" ? "#f87171" : ep.method === "PUT" ? "#60a5fa" : "#c084fc";
            return (
              <g key={i} transform={`translate(0, ${y})`}>
                {/* Connector line */}
                <line x1={116} y1={-20} x2={116} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                <line x1={116} y1={0} x2={140} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                <circle cx={140} cy={0} r={2} fill={methodFill} fillOpacity={0.6} />
                {/* Method badge */}
                <rect x={148} y={-9} width={32} height={16} rx={2} fill={`${methodFill}18`} stroke={`${methodFill}40`} strokeWidth={0.5} />
                <text x={164} y={5} textAnchor="middle" fill={methodFill} fontSize={9} fontWeight={600}>{ep.method}</text>
                {/* Path */}
                <text x={188} y={5} fill="rgba(255,255,255,0.6)" fontSize={10}>{ep.path.slice(0, 50)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Input vectors */}
      {vectors.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
            Input Vectors ({vectors.length})
          </p>
          <div className="space-y-1">
            {vectors.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[3px] border-[0.5px] border-white/[0.04] bg-white/[0.01] px-3 py-1.5"
              >
                <Circle size={5} className="shrink-0 fill-acid text-acid" />
                <span className="font-mono text-[10px] text-foreground-subtle">{v.type}</span>
                <span className="font-mono text-[10px] text-foreground-muted">{v.param}</span>
                <span className="ml-auto truncate font-mono text-[9px] text-foreground-subtle opacity-50">{v.url.slice(0, 40)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FINANCIAL RISK panel                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function ArcGauge({ value, max, danger }: { value: number; max: number; danger: boolean }) {
  const pct   = Math.min(value / max, 1);
  const R     = 80;
  const CX    = 100;
  const CY    = 100;
  const START = Math.PI;
  const END   = 2 * Math.PI;
  const angle = START + pct * (END - START);

  const arc = (a: number) => [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  const [sx, sy] = arc(START);
  const [ex, ey] = arc(angle);
  const largeArc = pct > 0.5 ? 1 : 0;

  const trackPath = `M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}`;
  const fillPath  = pct === 0 ? "" : `M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`;

  const fill = danger
    ? pct > 0.66 ? "#ef4444" : pct > 0.33 ? "#f97316" : "#facc15"
    : "#d1ff00";

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[240px]">
      <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} strokeLinecap="round" />
      {fillPath && (
        <path d={fillPath} fill="none" stroke={fill} strokeWidth={12} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${fill}88)` }} />
      )}
      {/* Needle */}
      <line
        x1={CX} y1={CY}
        x2={CX + (R - 16) * Math.cos(angle)}
        y2={CY + (R - 16) * Math.sin(angle)}
        stroke={fill} strokeWidth={2} strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={4} fill={fill} />
    </svg>
  );
}

function SovereignTelemetrySparkline({ trend }: { trend: number[] }) {
  const max = Math.max(...trend, 1);
  const w = 120;
  const h = 32;
  const step = trend.length > 1 ? w / (trend.length - 1) : w;
  const points = trend
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`)
    .join(" ");

  return (
    <div className="rounded border border-white/[0.06] bg-black/30 px-4 py-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-acid">
        Sovereign Telemetry — platform scan activity (30d)
      </p>
      <svg width={w} height={h} className="text-acid" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    </div>
  );
}

function FinancialRisk({
  aleUsd,
  scanSealed = false,
  telemetryTrend,
}: {
  aleUsd: number | null;
  scanSealed?: boolean;
  telemetryTrend?: number[];
}) {
  if (aleUsd === null || aleUsd === undefined) {
    if (scanSealed && telemetryTrend && telemetryTrend.some((n) => n > 0)) {
      return <SovereignTelemetrySparkline trend={telemetryTrend} />;
    }
    return <EmptyState label="Financial risk quantification not yet available." icon={DollarSign} />;
  }

  const aleDisplay = formatAleDisplay(aleUsd);
  const danger    = aleUsd > 500_000;
  const risk_tier =
    aleUsd >= 4_500_000 ? "CATASTROPHIC"
    : aleUsd >= 2_000_000 ? "SEVERE"
    : aleUsd >= 500_000 ? "ELEVATED"
    : aleUsd >= 100_000 ? "MODERATE"
    : "LOW";

  const TIER_COLOR: Record<string, string> = {
    CATASTROPHIC: "text-[#ef4444]",
    SEVERE:       "text-[#f97316]",
    ELEVATED:     "text-[#facc15]",
    MODERATE:     "text-acid",
    LOW:          "text-[#4ade80]",
  };

  const tColor = TIER_COLOR[risk_tier] || "text-foreground";

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
      {/* Gauge */}
      <div className="flex flex-col items-center gap-2">
        <ArcGauge value={aleUsd} max={4_500_000} danger={danger} />
        <p className={`font-mono text-2xl font-bold tabular-nums ${danger ? "text-[#ef4444]" : "text-acid"}`}
           style={{ textShadow: danger ? "0 0 20px rgba(239,68,68,0.5)" : "0 0 20px rgba(209,255,0,0.4)" }}>
          ${aleDisplay}
        </p>
        <p className="font-mono text-[10px] text-foreground-muted">Projected Annual Loss</p>
      </div>

      {/* Details */}
      <div className="flex-1 space-y-4">
        {/* Risk tier badge */}
        <div className={`inline-flex items-center gap-2 rounded-[3px] border-[0.5px] border-current bg-current/5 px-3 py-1.5 ${tColor}`}>
          <AlertTriangle size={11} strokeWidth={2} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em]">
            {risk_tier}
          </span>
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          {[
            { label: "IBM 2026 baseline breach cost", value: "$4,500,000" },
            { label: "Projected ALE (industry-adjusted)", value: `$${aleUsd.toLocaleString()}` },
            { label: "Risk tier",                         value: risk_tier },
            { label: "Methodology",                       value: "IBM Cost of a Data Breach 2026" },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 border-b-[0.5px] border-white/[0.04] pb-1.5">
              <span className="font-mono text-[10px] text-foreground-subtle">{r.label}</span>
              <span className={`font-mono text-[10px] font-semibold tabular-nums ${r.label.includes("ALE") ? (danger ? "text-[#ef4444]" : "text-acid") : "text-foreground"}`}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <p className="font-mono text-[9px] text-foreground-subtle/50">
          ALE = Annual Exploit Probability × Single-Loss Expectancy × Industry Multiplier.
          Figures are probabilistic estimates, not guarantees.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* AEGIS BUNDLE panel                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function AegisBundle({ scanId, zipB64 }: { scanId: string; zipB64: string | null }) {
  const [downloading, setDownloading] = React.useState(false);

  function handleDownload() {
    if (!zipB64) return;
    setDownloading(true);
    try {
      const bytes = Uint8Array.from(atob(zipB64), (c) => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "application/zip" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `forgeguard-aegis-${scanId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const sizeKb = zipB64
    ? Math.round((zipB64.length * 0.75) / 1024)
    : 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-sm font-semibold text-foreground">Aegis Rule Bundle</p>
          <p className="font-mono text-[11px] text-foreground-muted">
            Production-ready guardrails for three deployment layers: Cloudflare / FastAPI / Next.js Edge.
          </p>
          {zipB64 && (
            <p className="font-mono text-[10px] text-foreground-subtle">
              {sizeKb} KB · 3 artifact types per vulnerability
            </p>
          )}
        </div>

        {zipB64 ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex shrink-0 items-center gap-2 rounded-[3px] border-[0.5px] border-acid/40 bg-acid/[0.06] px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-acid transition-all hover:border-acid/70 hover:bg-acid/[0.12] hover:shadow-[0_0_20px_rgba(209,255,0,0.1)] disabled:opacity-40"
          >
            <Download size={13} strokeWidth={2} />
            {downloading ? "Preparing…" : "Download .zip"}
          </button>
        ) : (
          <span className="font-mono text-[10px] text-foreground-subtle/50">
            Bundle not yet generated
          </span>
        )}
      </div>

      {/* Layer cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "FastAPI Middleware",
            desc: "Python middleware for origin server. Intercepts and validates all LLM-bound requests.",
            lang: "Python",
            color: "text-[#4ade80]",
          },
          {
            title: "Next.js Edge Middleware",
            desc: "TypeScript middleware deployed at the CDN edge. Zero cold-start, sub-ms interception.",
            lang: "TypeScript",
            color: "text-[#60a5fa]",
          },
          {
            title: "System Prompt Hardening",
            desc: "Markdown instruction set to prepend to every LLM system prompt in your deployment.",
            lang: "Markdown",
            color: "text-acid",
          },
        ].map((layer) => (
          <div
            key={layer.title}
            className="rounded-[3px] border-[0.5px] border-white/[0.06] bg-white/[0.02] p-4 space-y-2"
          >
            <p className={`font-mono text-[11px] font-semibold ${layer.color}`}>{layer.title}</p>
            <p className="font-mono text-[10px] text-foreground-subtle leading-relaxed">{layer.desc}</p>
            <span className={`inline-block rounded-[2px] border-[0.5px] border-current bg-current/5 px-1.5 py-0.5 font-mono text-[9px] uppercase ${layer.color}`}>
              {layer.lang}
            </span>
          </div>
        ))}
      </div>

      {!zipB64 && (
        <div className="rounded-[3px] border-[0.5px] border-white/[0.04] bg-white/[0.01] p-4 text-center">
          <Shield size={20} strokeWidth={1} className="mx-auto mb-2 text-foreground-subtle/30" />
          <p className="font-mono text-[10px] text-foreground-subtle">
            Aegis bundle is generated once the scan seals. Re-check after completion.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SOCIAL SWARM panel                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function SocialSwarm({ templates }: { templates: SocialTemplate[] | null }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (!templates || templates.length === 0) {
    return <EmptyState label="Social engineering templates not yet generated." icon={Users} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-foreground-muted">
          Security awareness training templates — authorised use only.
        </p>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#ef4444] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.04)] px-2 py-0.5 rounded-[2px]">
          TRAINING ONLY
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => {
          const isOpen = expanded === t.template_id;
          return (
            <div
              key={t.template_id}
              className="rounded-[3px] border-[0.5px] border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpanded(isOpen ? null : t.template_id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground-subtle border border-white/[0.08] px-1.5 py-0.5 rounded-[2px]">
                      {t.platform}
                    </span>
                    <span className="font-mono text-[9px] text-foreground-subtle/60">{t.category}</span>
                  </div>
                  <p className="font-mono text-[11px] font-medium text-foreground truncate pr-4">
                    {t.subject}
                  </p>
                </div>
                <ChevronRight
                  size={12}
                  strokeWidth={1.75}
                  className={`shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t-[0.5px] border-white/[0.06] p-4 space-y-4">
                      {/* Content */}
                      <div>
                        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground-subtle">
                          Template Content
                        </p>
                        <pre className="overflow-x-auto rounded-[3px] bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                          {t.content}
                        </pre>
                      </div>

                      {/* Red flags */}
                      {t.red_flags?.length > 0 && (
                        <div>
                          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#f97316]">
                            🚩 Red Flags (what employees should look for)
                          </p>
                          <ul className="space-y-1">
                            {t.red_flags.map((flag, i) => (
                              <li key={i} className="flex items-start gap-2 font-mono text-[10px] text-foreground-muted">
                                <span className="mt-0.5 shrink-0 text-[#f97316]">›</span>
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Training debrief */}
                      {t.training_debrief && (
                        <div className="rounded-[3px] border-[0.5px] border-acid/20 bg-acid/[0.03] p-3">
                          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-acid">
                            Training Debrief
                          </p>
                          <p className="font-mono text-[10px] leading-relaxed text-foreground-muted">
                            {t.training_debrief}
                          </p>
                        </div>
                      )}

                      {/* Watermark */}
                      <p className="font-mono text-[9px] text-foreground-subtle/40">
                        Watermark: {t.watermark} · {t.template_id}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[9px] text-foreground-subtle/40">
        FOR AUTHORISED SECURITY TRAINING ONLY. Templates are forensically watermarked.
        Do not distribute outside your organisation.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* AGENT_MEMORIES — Diagnostic Loop (Nuclear scans)                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function AgentMemoriesPanel({
  memories,
}: {
  memories: AgentMemoryRow[] | null | undefined;
}) {
  if (!memories || memories.length === 0) {
    return (
      <EmptyState
        label="Self-evolution trace not yet available. Nuclear scans stream agent reasoning here."
        icon={Brain}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] leading-relaxed text-white/55">
        Diagnostic Loop — the AI explains how it adapted payloads when target
        defenses resisted initial probes.
      </p>
      <ol className="flex flex-col gap-3">
        {memories.map((m, idx) => (
          <li
            key={m.id}
            className="rounded-[3px] border border-violet-400/20 bg-violet-400/[0.04] p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-violet-300">
                Step {idx + 1}
              </span>
              {m.agent_role && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                  {m.agent_role}
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-white/75">
              {m.thought}
            </p>
            {m.action_taken && (
              <p className="mt-2 font-mono text-[10px] text-acid/80">
                → {m.action_taken}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Utility                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function EmptyState({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon size={24} strokeWidth={1} className="text-foreground-subtle/30" />
      <p className="font-mono text-[11px] text-foreground-subtle">{label}</p>
    </div>
  );
}
