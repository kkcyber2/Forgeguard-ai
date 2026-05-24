"use client";

/**
 * CMD+K / CTRL+K Command Bar
 * ─────────────────────────────────────────────────────────────────────────────
 * Global keyboard-driven navigation overlay for the ForgeGuard Stronghold.
 * Opens on CMD+K (Mac) or CTRL+K (Windows/Linux) and closes on Escape or
 * any click outside the panel.
 *
 * Features:
 *  - Fuzzy-search across all nav destinations, actions, and recent scans
 *  - Keyboard navigation (↑↓ arrows + Enter to confirm)
 *  - Staggered Framer Motion entry
 *  - Zero external deps beyond what's already in the project
 */

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CreditCard,
  Crosshair,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Loader2,
  Radar,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

// ─── Command definitions ──────────────────────────────────────────────────────

interface Command {
  id:       string;
  label:    string;
  sublabel?: string;
  icon:     LucideIcon;
  href?:    string;
  action?:  () => void;
  group:    string;
  keywords: string[];
}

const STATIC_COMMANDS: Command[] = [
  // Navigation
  {
    id: "nav-overview", label: "Overview", sublabel: "Dashboard home",
    icon: LayoutDashboard, href: "/dashboard", group: "Navigate",
    keywords: ["overview", "home", "dashboard", "main"],
  },
  {
    id: "nav-scans", label: "Scans", sublabel: "View all scan reports",
    icon: Radar, href: "/dashboard/scans", group: "Navigate",
    keywords: ["scans", "reports", "findings", "results", "vulnerabilities"],
  },
  {
    id: "nav-new-scan", label: "New Scan", sublabel: "Launch a new red-team scan",
    icon: Radar, href: "/dashboard/scans/new", group: "Navigate",
    keywords: ["new scan", "start scan", "launch", "red team", "attack"],
  },
  {
    id: "nav-forge", label: "The Forge", sublabel: "Script execution terminal",
    icon: FlaskConical, href: "/dashboard/forge", group: "Navigate",
    keywords: ["forge", "terminal", "script", "execute", "run", "code"],
  },
  {
    id: "nav-aegis", label: "Aegis Defense", sublabel: "Export WAF rules",
    icon: ShieldCheck, href: "/dashboard/aegis", group: "Navigate",
    keywords: ["aegis", "waf", "defense", "rules", "cloudflare", "middleware", "export"],
  },
  {
    id: "nav-bounties", label: "Bounty Vault", sublabel: "Submit vulnerability reports",
    icon: Trophy, href: "/dashboard/bounties", group: "Navigate",
    keywords: ["bounty", "vault", "cvss", "vulnerability", "report", "bug"],
  },
  {
    id: "nav-intel", label: "Intel Hub", sublabel: "Threat intelligence & community",
    icon: Globe, href: "/dashboard/intel", group: "Navigate",
    keywords: ["intel", "intelligence", "news", "threat", "community", "chat"],
  },
  {
    id: "nav-scheduled", label: "Scheduled Scans", sublabel: "Recurring scan jobs",
    icon: Calendar, href: "/dashboard/scheduled", group: "Navigate",
    keywords: ["scheduled", "cron", "recurring", "automation", "jobs"],
  },
  {
    id: "nav-billing", label: "Billing", sublabel: "Subscription & payment",
    icon: CreditCard, href: "/dashboard/billing", group: "Navigate",
    keywords: ["billing", "payment", "subscription", "plan", "invoice"],
  },
  {
    id: "nav-settings", label: "Settings", sublabel: "Account & preferences",
    icon: Settings, href: "/dashboard/settings", group: "Navigate",
    keywords: ["settings", "account", "preferences", "profile", "api key"],
  },
  // Security actions
  {
    id: "action-new-scan", label: "Launch new scan", sublabel: "Scan a target for AI vulnerabilities",
    icon: Shield, href: "/dashboard/scans/new", group: "Actions",
    keywords: ["launch", "new", "scan", "attack", "probe"],
  },
  {
    id: "action-export-cf", label: "Export Cloudflare rules", sublabel: "Generate WAF rules from last scan",
    icon: ShieldAlert, href: "/dashboard/aegis", group: "Actions",
    keywords: ["export", "cloudflare", "rules", "waf", "generate"],
  },
  {
    id: "action-bounty", label: "Submit a bounty", sublabel: "Report a new vulnerability",
    icon: Trophy, href: "/dashboard/bounties", group: "Actions",
    keywords: ["submit", "bounty", "finding", "report", "disclose"],
  },
  {
    id: "action-topup", label: "Top Up Credits", sublabel: "Add wallet credits",
    icon: CreditCard, href: "/dashboard/billing", group: "Actions",
    keywords: ["top up", "credits", "billing", "payment", "wallet", "balance", "recharge"],
  },
  {
    id: "nav-bazaar", label: "Bazaar", sublabel: "Script marketplace",
    icon: Store, href: "/dashboard/bazaar", group: "Navigate",
    keywords: ["bazaar", "marketplace", "scripts", "hacker", "buy", "acquire", "tools"],
  },
  {
    id: "nav-missions", label: "Mission Vault", sublabel: "Security contracts marketplace",
    icon: Crosshair, href: "/dashboard/missions", group: "Navigate",
    keywords: ["mission", "missions", "vault", "contract", "marketplace", "job", "hacker", "gig", "security contract"],
  },
  // Sovereign identity actions
  {
    id: "action-post-mission", label: "Post a Mission", sublabel: "Create a new security contract",
    icon: Crosshair, href: "/dashboard/missions/new", group: "Actions",
    keywords: ["mission", "post", "create", "contract", "new mission", "post job", "hire hacker"],
  },
  {
    id: "action-verify-domain", label: "Verify Corporate Domain", sublabel: "Earn your [COMPANY SEC] badge",
    icon: BadgeCheck, href: "/dashboard/settings#domain", group: "Actions",
    keywords: ["verify", "domain", "corporate", "badge", "company", "sec", "google", "sovereign", "identity"],
  },
  {
    id: "action-verify-portal", label: "Verification Portal", sublabel: "Clearance progress & identity audit",
    icon: BadgeCheck, href: "/dashboard/settings#clearance", group: "Actions",
    keywords: ["verify", "verification", "clearance", "sovereign", "tactical", "professional", "identity", "audit", "sms", "otp"],
  },
];

const CLIENT_COMMAND_IDS = new Set([
  "nav-overview",
  "nav-aegis",
  "nav-bounties",
  "nav-scans",
  "nav-billing",
  "nav-settings",
  "action-export-cf",
  "action-bounty",
  "action-topup",
  "action-verify-domain",
  "action-verify-portal",
  "action-post-mission",
]);

const HACKER_COMMAND_IDS = new Set([
  "nav-overview",
  "nav-forge",
  "nav-bazaar",
  "nav-missions",
  "nav-intel",
  "nav-scheduled",
  "nav-new-scan",
  "nav-scans",
  "nav-billing",
  "nav-settings",
  "action-new-scan",
  "action-topup",
  "action-post-mission",
]);

function commandsForView(viewMode: ViewMode): Command[] {
  const allowed = viewMode === "client" ? CLIENT_COMMAND_IDS : HACKER_COMMAND_IDS;
  return STATIC_COMMANDS.filter((cmd) => allowed.has(cmd.id));
}

// ─── Fuzzy match ──────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, cmd: Command): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    cmd.label.toLowerCase().includes(q) ||
    (cmd.sublabel ?? "").toLowerCase().includes(q) ||
    cmd.keywords.some((k) => k.includes(q))
  );
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-3 py-1.5 mt-2 first:mt-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground-subtle/60">
        {label}
      </span>
    </div>
  );
}

// ─── Command item ─────────────────────────────────────────────────────────────

function CommandItem({
  cmd,
  active,
  onSelect,
  index,
}: {
  cmd:      Command;
  active:   boolean;
  onSelect: () => void;
  index:    number;
}) {
  const Icon = cmd.icon;
  const ref  = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xs px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-acid/[0.09] text-foreground"
          : "text-foreground-muted hover:bg-white/[0.04]",
      )}
    >
      <div className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border",
        active ? "border-acid/30 bg-acid/[0.12]" : "border-white/[0.07] bg-obsidian-700/40",
      )}>
        <Icon size={11} strokeWidth={1.5} className={active ? "text-acid" : "text-foreground-subtle"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[12px] font-medium truncate",
          active ? "text-foreground" : "text-foreground-muted",
        )}>
          {cmd.label}
        </p>
        {cmd.sublabel && (
          <p className="text-[10px] text-foreground-subtle truncate">{cmd.sublabel}</p>
        )}
      </div>
      {active && <ArrowRight size={11} strokeWidth={1.5} className="shrink-0 text-acid" />}
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandBar({ viewMode = "hacker" }: { viewMode?: ViewMode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [open,    setOpen]    = React.useState(false);
  const [query,   setQuery]   = React.useState("");
  const [cursor,  setCursor]  = React.useState(0);

  const inputRef  = React.useRef<HTMLInputElement>(null);
  const overlayId = React.useId();

  // ── Keyboard shortcut to open ─────────────────────────────────────────────
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Close on route change ─────────────────────────────────────────────────
  React.useEffect(() => { setOpen(false); }, [pathname]);

  // ── Reset state when opening ──────────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── /verify slash command ─────────────────────────────────────────────────
  const slashQuery = query.startsWith("/") ? query.slice(1).toLowerCase() : query;
  const isVerifySlash = query.startsWith("/") && "verify".startsWith(slashQuery);

  // ── Filtered results ──────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const pool = commandsForView(viewMode);
    const base = pool.filter((c) => fuzzyMatch(query.startsWith("/") ? slashQuery : query, c));
    if (isVerifySlash || slashQuery === "verify") {
      const verifyCmd: Command = {
        id: "slash-verify",
        label: "/verify",
        sublabel: "Jump to Sovereign verification portal",
        icon: BadgeCheck,
        href: "/dashboard/settings#clearance",
        group: "Commands",
        keywords: ["verify", "clearance", "sovereign"],
      };
      if (!base.some((c) => c.id === "slash-verify")) return [verifyCmd, ...base];
    }
    return base;
  }, [query, slashQuery, isVerifySlash, viewMode]);

  // ── Group results ─────────────────────────────────────────────────────────
  const grouped = React.useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group]!.push(cmd);
    }
    return groups;
  }, [filtered]);

  // ── Flatten for cursor indexing ───────────────────────────────────────────
  const flat = filtered;

  // ── Keyboard navigation inside palette ───────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((v) => Math.min(v + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flat[cursor];
      if (cmd) selectCommand(cmd);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function selectCommand(cmd: Command) {
    setOpen(false);
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      router.push(cmd.href);
    }
  }

  let flatIndex = 0;

  return (
    <>
      {/* Trigger hint visible in topbar — rendered here for portability */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "hidden md:flex items-center gap-2 rounded-xs border border-white/[0.07] bg-obsidian-800/40",
          "px-3 py-1.5 text-xs text-foreground-subtle hover:border-white/[0.12] hover:text-foreground transition-colors",
        )}
        aria-label="Open command palette"
      >
        <Search size={11} strokeWidth={1.5} />
        <span className="font-mono text-[10px]">Search…</span>
        <span className="ml-1 font-mono text-[9px] rounded-xs border border-white/[0.08] bg-obsidian-700/30 px-1.5 py-0.5 text-foreground-subtle/60">
          ⌘K
        </span>
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-obsidian-900/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Panel */}
            <motion.div
              key="panel"
              role="dialog"
              aria-modal
              aria-labelledby={overlayId}
              initial={{ opacity: 0, scale: 0.97, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
              className={cn(
                "fixed left-1/2 top-[18vh] z-50 w-full max-w-[580px] -translate-x-1/2",
                "flex flex-col rounded-sm border border-white/[0.1] bg-obsidian-800/95 shadow-2xl shadow-black/60 backdrop-blur-md",
                "overflow-hidden",
              )}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <Search size={14} strokeWidth={1.5} className="shrink-0 text-foreground-subtle" />
                <input
                  ref={inputRef}
                  id={overlayId}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                  onKeyDown={onKeyDown}
                  placeholder="Search commands, pages, actions…"
                  className="flex-1 bg-transparent font-mono text-[13px] text-foreground placeholder:text-foreground-subtle/50 focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setCursor(0); }}
                    className="rounded-xs p-0.5 hover:bg-white/[0.06] transition-colors"
                  >
                    <X size={11} strokeWidth={1.5} className="text-foreground-subtle" />
                  </button>
                )}
                <kbd className="font-mono text-[9px] rounded-xs border border-white/[0.08] bg-obsidian-700/40 px-1.5 py-0.5 text-foreground-subtle/50">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[420px] overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-white/10">
                {flat.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Loader2 size={16} strokeWidth={1.5} className="text-foreground-subtle/40" />
                    <p className="text-sm text-foreground-subtle">No commands match &ldquo;{query}&rdquo;</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, cmds]) => (
                    <div key={group}>
                      <GroupLabel label={group} />
                      {cmds.map((cmd) => {
                        const idx = flatIndex++;
                        return (
                          <CommandItem
                            key={cmd.id}
                            cmd={cmd}
                            active={cursor === idx}
                            onSelect={() => selectCommand(cmd)}
                            index={idx}
                          />
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 border-t border-white/[0.05] px-4 py-2">
                {[
                  { key: "↑↓", hint: "Navigate" },
                  { key: "↵",  hint: "Select"   },
                  { key: "ESC",hint: "Close"     },
                ].map(({ key, hint }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <kbd className="font-mono text-[9px] rounded-xs border border-white/[0.08] bg-obsidian-700/30 px-1.5 py-0.5 text-foreground-subtle/50">
                      {key}
                    </kbd>
                    <span className="text-[10px] text-foreground-subtle/40">{hint}</span>
                  </div>
                ))}
                <span className="ml-auto font-mono text-[9px] text-foreground-subtle/30">
                  ForgeGuard Stronghold
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
