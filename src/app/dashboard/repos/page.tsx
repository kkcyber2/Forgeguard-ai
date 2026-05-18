"use client";

/**
 * /dashboard/repos
 * ─────────────────────────────────────────────────────────────────────────────
 * Hacker-Git — Script Repository System
 *
 * Tabs:
 *   EXPLORE  — public repos, sorted by stars
 *   MY REPOS — authenticated user's repos
 *
 * Actions:
 *   New Repo — slide-in panel with name/description/language/visibility
 *   Star     — Legend rank (access_level ≥ 3) can star public repos
 *   View     — inline code viewer (Monaco-style pre with syntax hint)
 *
 * Aesthetic: Deep Sea Marineford — obsidian BG, acid-green accents,
 *            monospaced, sharp edges.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, Star, Lock, Globe2, Plus, X,
  ChevronDown, Search, Code2, Archive, Loader2,
  GitCommit, Eye, Copy, Check, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repo {
  id:           string;
  name:         string;
  description:  string;
  language:     string;
  tags:         string[];
  is_public:    boolean;
  is_archived:  boolean;
  star_count:   number;
  version:      string;
  commit_count: number;
  is_starred:   boolean;
  created_at:   string;
  updated_at:   string;
  owner: {
    full_name: string;
    username:  string;
    rank:      string;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  python:     "#3B82F6",
  bash:       "#10B981",
  javascript: "#F59E0B",
  rust:       "#EF4444",
};

const DEMO_REPOS: Repo[] = [
  {
    id: "r1", name: "phantom-scanner", description: "Distributed port scanner with AI-driven banner analysis and service fingerprinting.",
    language: "python", tags: ["recon", "scanner"], is_public: true, is_archived: false,
    star_count: 128, version: "2.3.1", commit_count: 47, is_starred: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "0xPhantom", username: "phantom", rank: "Legend" },
  },
  {
    id: "r2", name: "dns-exfil-toolkit", description: "Modular DNS exfiltration framework. Supports multiple encoding schemes.",
    language: "python", tags: ["dns", "exfil", "covert"], is_public: true, is_archived: false,
    star_count: 86, version: "1.1.0", commit_count: 23, is_starred: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "DeepSea_9", username: "deepsea9", rank: "Hacker" },
  },
  {
    id: "r3", name: "ssrf-hunter", description: "SSRF enumeration tool for cloud metadata endpoints with WAF bypass payloads.",
    language: "bash", tags: ["ssrf", "cloud"], is_public: true, is_archived: false,
    star_count: 55, version: "3.0.0", commit_count: 92, is_starred: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "r00tkitchen", username: "rootkitchen", rank: "Legend" },
  },
  {
    id: "r4", name: "jwt-cracker", description: "High-speed JWT secret brute-forcer with dictionary and rule-based attack modes.",
    language: "rust", tags: ["auth", "jwt", "brute-force"], is_public: true, is_archived: false,
    star_count: 203, version: "1.7.2", commit_count: 34, is_starred: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "IronForgeTech", username: "ironforge", rank: "Legend" },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LangTag({ lang }: { lang: string }) {
  const color = LANG_COLORS[lang] ?? "#6B7280";
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "#9CA3AF" }}>
      <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
      {lang.charAt(0).toUpperCase() + lang.slice(1)}
    </span>
  );
}

function StarButton({
  repo,
  onStar,
  starring,
}: {
  repo:    Repo;
  onStar:  (id: string, starred: boolean) => void;
  starring: string | null;
}) {
  const active  = repo.is_starred;
  const loading = starring === repo.id;
  return (
    <button
      onClick={() => onStar(repo.id, active)}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-all disabled:opacity-50"
      style={{
        border: "1px solid",
        borderColor: active ? "rgba(209,255,0,0.4)" : "rgba(255,255,255,0.08)",
        color:       active ? "#D1FF00" : "#4B5563",
        background:  active ? "rgba(209,255,0,0.06)" : "transparent",
      }}
      title="Legend rank required"
    >
      {loading
        ? <Loader2 size={11} className="animate-spin" />
        : <Star size={11} className={active ? "fill-[#D1FF00]" : ""} />
      }
      {repo.star_count}
    </button>
  );
}

function RepoCard({
  repo,
  onStar,
  onView,
  starring,
}: {
  repo:    Repo;
  onStar:  (id: string, starred: boolean) => void;
  onView:  (repo: Repo) => void;
  starring: string | null;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="group relative flex flex-col gap-3 p-4"
      style={{
        background: "#0A0A0A",
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "border-color 0.2s",
      }}
      whileHover={{ borderColor: "rgba(209,255,0,0.18)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch size={13} className="shrink-0 text-[#D1FF00]" />
          <button
            onClick={() => onView(repo)}
            className="font-mono text-[13px] font-semibold text-white hover:text-[#D1FF00] transition-colors truncate text-left"
          >
            {repo.name}
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {repo.is_archived && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#6B7280]"
              style={{ border: "1px solid rgba(107,114,128,0.2)" }}
            >
              <Archive size={9} /> Archived
            </span>
          )}
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest"
            style={
              repo.is_public
                ? { color: "#D1FF00", border: "1px solid rgba(209,255,0,0.2)", background: "rgba(209,255,0,0.05)" }
                : { color: "#6B7280", border: "1px solid rgba(107,114,128,0.2)" }
            }
          >
            {repo.is_public ? <Globe2 size={9} /> : <Lock size={9} />}
            {repo.is_public ? "Public" : "Private"}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] leading-relaxed text-[#6B7280] line-clamp-2">
        {repo.description || <span className="italic text-[#374151]">No description</span>}
      </p>

      {/* Tags */}
      {repo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {repo.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#4B5563]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <LangTag lang={repo.language} />
          <span className="flex items-center gap-1 text-[#4B5563] font-mono">
            <GitCommit size={10} />
            {repo.commit_count}
          </span>
          <span className="font-mono text-[#374151]">v{repo.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <StarButton repo={repo} onStar={onStar} starring={starring} />
          <button
            onClick={() => onView(repo)}
            className="flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-[#6B7280] transition-colors hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Eye size={11} /> View
          </button>
        </div>
      </div>

      {/* Owner */}
      <div className="flex items-center gap-1 border-t border-white/5 pt-2 text-[10px] font-mono text-[#374151]">
        <span className="text-[#D1FF00]">{repo.owner?.rank ?? "Hacker"}</span>
        <span className="mx-1 text-[#1F2937]">/</span>
        <span>{repo.owner?.username ?? "anon"}</span>
      </div>
    </motion.div>
  );
}

// ─── Code Viewer ──────────────────────────────────────────────────────────────

function CodeViewer({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const demoCode = `#!/usr/bin/env python3
"""
${repo.name} v${repo.version}
Part of the ForgeGuard Hacker-Git ecosystem.
"""

import asyncio
import sys

async def main():
    print(f"[{repo.name.upper()}] Initializing…")
    # Script logic here
    await asyncio.sleep(0)
    print("[DONE] Execution complete.")

if __name__ == "__main__":
    asyncio.run(main())
`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(demoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        className="w-full max-w-2xl flex flex-col"
        style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="text-[#D1FF00]" />
            <span className="font-mono text-[12px] text-white">{repo.name}</span>
            <span className="font-mono text-[10px] text-[#4B5563]">v{repo.version}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.08)", color: copied ? "#D1FF00" : "#6B7280" }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={onClose} className="text-[#4B5563] hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto p-4">
          <pre
            className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap"
            style={{ color: "#9CA3AF" }}
          >
            <code>{demoCode}</code>
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

// ─── New Repo Panel ───────────────────────────────────────────────────────────

function NewRepoPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (repo: Repo) => void }) {
  const [form, setForm] = React.useState({
    name: "", description: "", language: "python", tags: "", is_public: false,
  });
  const [saving, setSaving]   = React.useState(false);
  const [error,  setError]    = React.useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/repos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json() as { ok: boolean; repo?: Repo; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Failed to create repo");
      onCreate(data.repo!);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col"
      style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Plus size={15} className="text-[#D1FF00]" />
          <span className="font-mono text-[13px] font-semibold uppercase tracking-widest text-white">
            New Repository
          </span>
        </div>
        <button onClick={onClose} className="text-[#4B5563] hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {[
          { key: "name",        label: "Repository Name",  placeholder: "my-exploit-toolkit" },
          { key: "description", label: "Description",      placeholder: "What does this repo do?" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">{label}</label>
            <input
              className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              placeholder={placeholder}
              value={form[key as keyof typeof form] as string}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Language</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-transparent px-3 py-2 font-mono text-[12px] text-white focus:outline-none cursor-pointer"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              >
                {["python", "bash", "javascript", "rust"].map((l) => (
                  <option key={l} value={l} className="bg-[#0A0A0A]">{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Visibility</label>
            <button
              onClick={() => setForm((p) => ({ ...p, is_public: !p.is_public }))}
              className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[12px] transition-all"
              style={{
                border: "1px solid",
                borderColor: form.is_public ? "rgba(209,255,0,0.3)" : "rgba(255,255,255,0.08)",
                color: form.is_public ? "#D1FF00" : "#6B7280",
                background: form.is_public ? "rgba(209,255,0,0.06)" : "transparent",
              }}
            >
              {form.is_public ? <Globe2 size={12} /> : <Lock size={12} />}
              {form.is_public ? "Public" : "Private"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Tags (comma-separated)</label>
          <input
            className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            placeholder="recon, ssrf, bypass"
            value={form.tags}
            onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 font-mono text-[12px] text-[#EF4444]"
            style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
          >
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>

      <div
        className="px-6 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          disabled={saving || !form.name}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40"
          style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
        >
          {saving ? (
            <><Loader2 size={12} className="animate-spin" />Creating…</>
          ) : (
            <><Plus size={12} />Create Repository</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReposPage() {
  const [tab, setTab]           = React.useState<"explore" | "mine">("explore");
  const [repos, setRepos]       = React.useState<Repo[]>(DEMO_REPOS);
  const [myRepos, setMyRepos]   = React.useState<Repo[]>([]);
  const [loading, setLoading]   = React.useState(true);
  const [search, setSearch]     = React.useState("");
  const [filterLang, setLang]   = React.useState("all");
  const [showNew, setShowNew]   = React.useState(false);
  const [viewRepo, setViewRepo] = React.useState<Repo | null>(null);
  const [starring, setStarring] = React.useState<string | null>(null);

  const loadRepos = React.useCallback(async (mine: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (mine) params.set("mine", "true");
      if (filterLang !== "all") params.set("lang", filterLang);
      const res  = await fetch(`/api/repos?${params}`);
      const data = await res.json() as { ok: boolean; repos?: Repo[] };
      if (data.ok && data.repos) {
        if (mine) setMyRepos(data.repos);
        else      setRepos(data.repos.length ? data.repos : DEMO_REPOS);
      }
    } catch {
      // keep demo data
    } finally {
      setLoading(false);
    }
  }, [filterLang]);

  React.useEffect(() => {
    void loadRepos(tab === "mine");
  }, [tab, filterLang, loadRepos]);

  const handleStar = async (repoId: string, currentlyStarred: boolean) => {
    setStarring(repoId);
    try {
      const res = await fetch("/api/repos/star", {
        method:  currentlyStarred ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ repo_id: repoId }),
      });
      const data = await res.json() as { ok: boolean; starred: boolean; star_count: number; error?: string; code?: string };
      if (data.ok) {
        const update = (prev: Repo[]) =>
          prev.map((r) =>
            r.id === repoId
              ? { ...r, is_starred: data.starred, star_count: data.star_count }
              : r
          );
        setRepos(update);
        setMyRepos(update);
      } else if (data.code === "IDENTITY_GATE") {
        // Legend rank required — surface feedback
        console.warn("[Repos] Legend rank required to star repositories.");
      }
    } catch {
      // silent
    } finally {
      setStarring(null);
    }
  };

  const activeRepos = (tab === "mine" ? myRepos : repos).filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.includes(q))
    );
  });

  const totalStars = repos.reduce((acc, r) => acc + r.star_count, 0);

  return (
    <div className="min-h-screen" style={{ background: "#050505" }}>

      {/* Modals */}
      <AnimatePresence>
        {viewRepo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
              onClick={() => setViewRepo(null)}
            />
            <CodeViewer repo={viewRepo} onClose={() => setViewRepo(null)} />
          </>
        )}
        {showNew && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
              onClick={() => setShowNew(false)}
            />
            <NewRepoPanel
              onClose={() => setShowNew(false)}
              onCreate={(repo) => setMyRepos((p) => [repo, ...p])}
            />
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={18} className="text-[#D1FF00]" />
                <h1 className="font-mono text-xl font-bold tracking-tight text-white">HACKER-GIT</h1>
                <span
                  className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                  style={{ background: "rgba(209,255,0,0.08)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.2)" }}
                >
                  v1.0
                </span>
              </div>
              <p className="font-mono text-[12px] text-[#4B5563]">
                GitHub for hackers. Legend-rank users earn +10 rep per star received.
              </p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all"
              style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
            >
              <Plus size={13} />
              New Repo
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 flex items-center gap-6">
            {[
              { label: "Public Repos", value: repos.filter((r) => r.is_public).length, icon: Globe2 },
              { label: "Total Stars",  value: totalStars, icon: Star },
              { label: "My Repos",     value: myRepos.length, icon: GitBranch },
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

      {/* Tabs + Toolbar */}
      <div
        className="sticky top-0 z-10 px-6"
        style={{ background: "rgba(5,5,5,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="mx-auto max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-0">
            {(["explore", "mine"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors"
                style={{ color: tab === t ? "#D1FF00" : "#4B5563" }}
              >
                {t === "explore" ? "Explore" : "My Repos"}
                {tab === t && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: "#D1FF00" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search + filter row */}
          <div className="flex items-center gap-3 pb-3">
            <div
              className="relative flex flex-1 items-center"
              style={{ border: "1px solid rgba(255,255,255,0.08)", maxWidth: 280 }}
            >
              <Search size={12} className="absolute left-3 text-[#4B5563]" />
              <input
                className="w-full bg-transparent py-1.5 pl-9 pr-3 font-mono text-[12px] text-white placeholder:text-[#374151] focus:outline-none"
                placeholder="Search repos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="appearance-none bg-transparent py-1.5 pl-3 pr-8 font-mono text-[11px] text-[#9CA3AF] focus:outline-none cursor-pointer"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                value={filterLang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="all"        className="bg-[#0A0A0A]">All Languages</option>
                <option value="python"     className="bg-[#0A0A0A]">Python</option>
                <option value="bash"       className="bg-[#0A0A0A]">Bash</option>
                <option value="javascript" className="bg-[#0A0A0A]">JavaScript</option>
                <option value="rust"       className="bg-[#0A0A0A]">Rust</option>
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-[#D1FF00]" />
          </div>
        ) : activeRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <GitBranch size={32} className="mb-3 text-[#1F2937]" />
            <p className="font-mono text-[13px] text-[#374151]">
              {tab === "mine" ? "No repositories yet. Create your first one." : "No repos match."}
            </p>
            {tab === "mine" && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-[#D1FF00]"
                style={{ border: "1px solid rgba(209,255,0,0.2)" }}
              >
                <Plus size={11} />
                New Repo
              </button>
            )}
          </div>
        ) : (
          <motion.div
            layout
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
          >
            <AnimatePresence mode="popLayout">
              {activeRepos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  onStar={handleStar}
                  onView={setViewRepo}
                  starring={starring}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Legend rank note */}
      <div
        className="mx-auto max-w-6xl px-6 pb-8"
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 font-mono text-[11px] text-[#4B5563]"
          style={{ border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.02)" }}
        >
          <Star size={11} className="text-[#D1FF00] shrink-0" />
          <span>
            Starring requires <span className="text-[#D1FF00]">Legend rank</span> (access_level ≥ 3).
            Each star grants the repo owner <span className="text-white">+10 reputation</span>.
          </span>
        </div>
      </div>
    </div>
  );
}
