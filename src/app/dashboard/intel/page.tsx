"use client";

/**
 * /dashboard/intel — Intelligence Hub
 * ─────────────────────────────────────────────────────────────────────────────
 * Community threat intelligence feed with two panels:
 *
 *   1. Live Chat  — Supabase Realtime-backed community channel where
 *                   operators share findings, TTPs, and mitigations.
 *                   RLS on `intel_messages` scopes visibility to
 *                   authenticated users; messages INSERT on behalf of
 *                   auth.uid().
 *
 *   2. Threat Feed — Static-seeded + auto-scrolling ticker of recent
 *                    CVEs, AI-specific threat advisories, and ForgeGuard
 *                    platform intel. Swap the THREAT_FEED constant for a
 *                    live NVD / OSV API call when a key is available.
 *
 * Aesthetic: Cold Obsidian + Acid Green, monospaced data grids, sharp 4 px
 * corners, 0.5 px borders, staggered entry animations via Framer Motion.
 */

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Globe,
  MessageSquare,
  Send,
  Shield,
  ShieldAlert,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id:           string;
  user_id:      string;
  display_name: string;   // from intel_messages_with_profile view
  content:      string;   // column name in intel_messages
  created_at:   string;
}

interface ThreatItem {
  id:       string;
  label:    string;
  severity: "critical" | "high" | "medium" | "info";
  source:   string;
  ts:       string;
}

// ─── Static threat feed seed ─────────────────────────────────────────────────
// Replace with live NVD/OSV/Mitre feed when API key is available.

const THREAT_FEED: ThreatItem[] = [
  {
    id:       "cve-2025-0001",
    label:    "CVE-2025-0001 — Prompt injection via tool-call return values in multi-agent LLM pipelines",
    severity: "critical",
    source:   "NVD / AI-CERT",
    ts:       "2025-05-16T09:00:00Z",
  },
  {
    id:       "fg-adv-001",
    label:    "ForgeGuard Advisory — Unicode homoglyph bypass against GPT-4o content policy filters confirmed at 91% rate",
    severity: "high",
    source:   "ForgeGuard Research",
    ts:       "2025-05-15T14:22:00Z",
  },
  {
    id:       "cve-2025-1143",
    label:    "CVE-2025-1143 — Indirect prompt injection via PDF metadata in RAG pipelines (LangChain ≤ 0.2.14)",
    severity: "critical",
    source:   "NVD",
    ts:       "2025-05-14T11:45:00Z",
  },
  {
    id:       "fg-adv-002",
    label:    "ForgeGuard Advisory — Jailbreak persistence across session boundaries via system prompt caching",
    severity: "high",
    source:   "ForgeGuard Research",
    ts:       "2025-05-13T08:30:00Z",
  },
  {
    id:       "mitre-t1059",
    label:    "MITRE ATLAS T1059.010 — LLM Prompt Injection technique updated with multi-modal attack vectors",
    severity: "medium",
    source:   "MITRE ATLAS",
    ts:       "2025-05-12T16:00:00Z",
  },
  {
    id:       "cve-2025-2210",
    label:    "CVE-2025-2210 — System prompt extraction via structured output coercion in OpenAI function calling",
    severity: "high",
    source:   "NVD / HackerOne",
    ts:       "2025-05-11T09:15:00Z",
  },
  {
    id:       "fg-adv-003",
    label:    "ForgeGuard Advisory — Markdown callback exfiltration rate drops 94% with strict output rendering policy",
    severity: "info",
    source:   "ForgeGuard Research",
    ts:       "2025-05-10T12:00:00Z",
  },
  {
    id:       "cve-2025-3017",
    label:    "CVE-2025-3017 — Insecure deserialization in LlamaIndex document loaders enables RCE",
    severity: "critical",
    source:   "NVD",
    ts:       "2025-05-09T07:30:00Z",
  },
];

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEV_COLOR: Record<ThreatItem["severity"], string> = {
  critical: "text-threat",
  high:     "text-amber-400",
  medium:   "text-yellow-500",
  info:     "text-acid",
};

const SEV_DOT: Record<ThreatItem["severity"], string> = {
  critical: "bg-threat animate-pulse",
  high:     "bg-amber-400",
  medium:   "bg-yellow-500",
  info:     "bg-acid",
};

const SEV_LABEL: Record<ThreatItem["severity"], string> = {
  critical: "CRIT",
  high:     "HIGH",
  medium:   "MED",
  info:     "INFO",
};

// ─── Ticker ───────────────────────────────────────────────────────────────────

function ThreatTicker() {
  const [paused, setPaused] = React.useState(false);
  const doubled = [...THREAT_FEED, ...THREAT_FEED];

  return (
    <div
      className="relative overflow-hidden border-b border-white/[0.05] bg-obsidian-950/60 py-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-obsidian-950/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-obsidian-950/80 to-transparent" />

      <div
        className="flex gap-8 whitespace-nowrap"
        style={{
          animation: paused ? "none" : "marquee 80s linear infinite",
        }}
      >
        {doubled.map((item, i) => (
          <span key={`${item.id}-${i}`} className="inline-flex items-center gap-2">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", SEV_DOT[item.severity])} />
            <span className={cn("font-mono text-[10px] font-medium uppercase tracking-[0.12em]", SEV_COLOR[item.severity])}>
              [{SEV_LABEL[item.severity]}]
            </span>
            <span className="font-mono text-[11px] text-steel-300">{item.label}</span>
            <span className="font-mono text-[10px] text-steel-700">— {item.source}</span>
            <span className="mx-2 text-steel-800">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Threat feed list ─────────────────────────────────────────────────────────

function ThreatFeedList() {
  const reduce = useReducedMotion();
  return (
    <ul className="flex flex-col divide-y divide-white/[0.04]">
      {THREAT_FEED.map((item, i) => (
        <motion.li
          key={item.id}
          initial={reduce ? false : { opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEV_DOT[item.severity])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn("font-mono text-[9px] font-semibold uppercase tracking-[0.14em]", SEV_COLOR[item.severity])}>
                {item.severity}
              </span>
              <span className="font-mono text-[9px] text-steel-700">·</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-steel-700">
                {item.source}
              </span>
            </div>
            <p className="text-sm text-foreground-muted leading-relaxed">{item.label}</p>
          </div>
          <time className="shrink-0 font-mono text-[10px] text-steel-800 pt-0.5">
            {new Date(item.ts).toLocaleDateString([], { month: "short", day: "numeric" })}
          </time>
        </motion.li>
      ))}
    </ul>
  );
}

// ─── Community chat ───────────────────────────────────────────────────────────

function CommunityChat() {
  const reduce = useReducedMotion();
  const [messages, setMessages]   = React.useState<ChatMessage[]>([]);
  const [input, setInput]         = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [sending, setSending]     = React.useState(false);
  const [userId, setUserId]       = React.useState<string | null>(null);
  const [handle, setHandle]       = React.useState("operator");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Get current user + subscribe to Realtime
  React.useEffect(() => {
    const supabase = createClient();

    // Get current session
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setHandle(data.user.email?.split("@")[0] ?? "operator");
      }
    });

    // Load last 50 messages via the view (includes display_name join)
    void supabase
      .from("intel_messages_with_profile")
      .select("id, user_id, content, created_at, display_name")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[]);
      });

    // Realtime subscription — watches the base table; display_name is
    // computed as the email prefix of user_id for incoming rows.
    const channel = supabase
      .channel("intel_messages:global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intel_messages" },
        (payload) => {
          const row = payload.new as {
            id: string; user_id: string; content: string; created_at: string;
          };
          const msg: ChatMessage = {
            id:           String(row.id),
            user_id:      row.user_id,
            content:      row.content,
            created_at:   row.created_at,
            // For the own-user case we have the handle in state already.
            // For others, fall back to truncated user_id until next page load.
            display_name: row.user_id === userId ? handle : row.user_id.slice(0, 8),
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev.slice(-199), msg];
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => { void supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sending || !userId) return;

    setInput("");
    setSending(true);

    try {
      const supabase = createClient();
      // Only insert columns that exist in the table: user_id + content.
      // display_name is derived server-side via the view join.
      await supabase.from("intel_messages").insert({
        user_id: userId,
        content: body,
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={12} strokeWidth={1.5} className="text-foreground-muted" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
            Community Channel
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors",
            connected ? "bg-acid animate-pulse" : "bg-steel-700",
          )} />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-foreground-subtle">
            {connected ? "live" : "connecting"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xs border border-white/[0.06] bg-obsidian-800/60">
              <MessageSquare size={14} strokeWidth={1.5} className="text-foreground-subtle" />
            </div>
            <p className="text-sm text-foreground-muted">No messages yet.</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
              Be the first to share an intel finding
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                className={cn(
                  "flex flex-col gap-0.5",
                  msg.user_id === userId ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono text-[9px] uppercase tracking-[0.12em]",
                    msg.user_id === userId ? "text-acid" : "text-foreground-subtle",
                  )}>
                    {msg.display_name}
                  </span>
                  <span className="font-mono text-[9px] text-steel-800">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour:   "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-sm px-3 py-2 text-sm leading-relaxed",
                  msg.user_id === userId
                    ? "bg-acid/[0.08] border border-acid/20 text-foreground"
                    : "bg-obsidian-700/60 border border-white/[0.06] text-foreground-muted",
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-obsidian-800/60 px-3 py-2 focus-within:border-white/[0.16] transition-colors">
          <Terminal size={12} strokeWidth={1.5} className="shrink-0 text-foreground-subtle" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={userId ? "Share a finding or TTP…" : "Sign in to participate"}
            disabled={!userId || sending}
            maxLength={500}
            className="flex-1 bg-transparent font-mono text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending || !userId}
            className="shrink-0 text-foreground-subtle hover:text-acid disabled:opacity-30 transition-colors"
          >
            <Send size={12} strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-foreground-subtle">
          Enter to send · Max 500 chars · Operator discussions only
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntelPage() {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-0 pb-12 -mx-6 -mt-6">
      {/* Ticker banner */}
      <ThreatTicker />

      <div className="px-6 pt-6 flex flex-col gap-6">
        {/* Page header */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <Globe size={16} strokeWidth={1.5} className="text-acid" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
              Intelligence Hub
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Community Threat Intelligence
          </h1>
          <p className="max-w-xl text-sm text-foreground-muted">
            Real-time threat advisories, CVE tracking, and operator discussions.
            Share findings. Build collective defence.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: "Active advisories", value: THREAT_FEED.filter(t => t.severity === "critical" || t.severity === "high").length, icon: ShieldAlert, tone: "threat" },
            { label: "CVEs tracked",       value: THREAT_FEED.filter(t => t.id.startsWith("cve")).length, icon: Shield, tone: "neutral" },
            { label: "Threat items",        value: THREAT_FEED.length, icon: TrendingUp, tone: "acid" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-obsidian-800/40 px-4 py-3"
            >
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-xs border",
                tone === "threat" ? "border-threat/20 bg-threat/[0.06]" :
                tone === "acid"   ? "border-acid/20 bg-acid/[0.06]"     : "border-white/[0.06] bg-obsidian-700/40",
              )}>
                <Icon size={12} strokeWidth={1.5} className={
                  tone === "threat" ? "text-threat" :
                  tone === "acid"   ? "text-acid"   : "text-foreground-muted"
                } />
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
                <p className="text-[11px] text-foreground-muted">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Threat feed */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={12} strokeWidth={1.5} className="text-foreground-muted" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
                Live Threat Feed
              </span>
            </div>
            <div className="rounded-sm border border-white/[0.06] bg-obsidian-800/40 overflow-hidden">
              <ThreatFeedList />
            </div>
          </div>

          {/* Community chat */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="flex flex-col rounded-sm border border-white/[0.06] bg-obsidian-800/40 overflow-hidden"
            style={{ minHeight: "480px" }}
          >
            <CommunityChat />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
