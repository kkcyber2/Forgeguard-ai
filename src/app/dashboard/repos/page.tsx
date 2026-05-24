"use client";

/**
 * /dashboard/repos  — Hacker-Git v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-column layout:
 *   [1] Repo sidebar  (w-64)  – list of repos with MY REPOS / EXPLORE tabs
 *   [2] File tree     (w-56)  – virtual folder hierarchy from repo_files.path
 *   [3] Main panel    (flex-1)– New Repo · New File · file viewer · empty state
 *
 * Storage: hacker-repos bucket via /api/repos/files (GET/POST/DELETE)
 * ZIP:     /api/repos/zip/[repoId]  (hand-rolled PKZIP, opened in new tab)
 *
 * Aesthetic: Deep-Sea Marineford — obsidian BG, acid-green accents, hairline borders.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, Star, Lock, Globe2, Plus, X, Trash2,
  ChevronDown, ChevronRight, Search, Loader2,
  Folder, FolderOpen, FileText, Download, AlertCircle,
  Archive, Upload,
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
  owner: { full_name: string; username: string; rank: string } | null;
}

interface RepoFile {
  id:          string;
  path:        string;
  name:        string;
  size_bytes:  number;
  mime_type:   string;
  storage_key: string;
  created_at:  string;
  updated_at:  string;
}

interface TreeNode {
  kind:     "folder" | "file";
  name:     string;
  path:     string;          // logical path segment (no leading slash)
  file?:    RepoFile;        // only for kind="file"
  children: TreeNode[];
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(files: RepoFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  function insert(node: TreeNode[], parts: string[], file: RepoFile, basePath: string) {
    const [head, ...rest] = parts;
    if (!head) return;

    if (rest.length === 0) {
      // leaf — file
      node.push({ kind: "file", name: head, path: basePath + head, file, children: [] });
    } else {
      // folder
      let folder = node.find((n) => n.kind === "folder" && n.name === head);
      if (!folder) {
        folder = { kind: "folder", name: head, path: basePath + head, children: [] };
        node.push(folder);
      }
      insert(folder.children, rest, file, basePath + head + "/");
    }
  }

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    const parts = f.path.replace(/^\//, "").split("/");
    insert(root, parts, f, "");
  }
  return root;
}

// ─── TreeNodeView ─────────────────────────────────────────────────────────────

function TreeNodeView({
  node,
  selected,
  onSelect,
  onDelete,
  depth = 0,
}: {
  node:     TreeNode;
  selected: RepoFile | null;
  onSelect: (f: RepoFile) => void;
  onDelete: (f: RepoFile) => void;
  depth?:   number;
}) {
  const [open, setOpen] = React.useState(true);

  if (node.kind === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex w-full items-center gap-1.5 px-2 py-1 font-mono text-[11px] text-[#9CA3AF] hover:text-white transition-colors"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {open
            ? <ChevronDown size={10} className="shrink-0 text-[#4B5563]" />
            : <ChevronRight size={10} className="shrink-0 text-[#4B5563]" />
          }
          {open
            ? <FolderOpen size={11} className="shrink-0 text-[#D1FF00]/60" />
            : <Folder size={11} className="shrink-0 text-[#D1FF00]/40" />
          }
          <span className="truncate">{node.name}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <TreeNodeView
                  key={child.path}
                  node={child}
                  selected={selected}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // file
  const isActive = selected?.id === node.file?.id;
  return (
    <div
      className="group relative flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-colors"
      style={{
        paddingLeft: 8 + depth * 14,
        background:  isActive ? "rgba(209,255,0,0.07)" : "transparent",
      }}
      onClick={() => node.file && onSelect(node.file)}
    >
      <FileText size={10} className="shrink-0 text-[#4B5563]" />
      <span
        className="flex-1 truncate font-mono text-[11px] transition-colors"
        style={{ color: isActive ? "#D1FF00" : "#9CA3AF" }}
      >
        {node.name}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); node.file && onDelete(node.file); }}
        className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#4B5563] hover:text-[#EF4444]"
        title="Delete file"
      >
        <Trash2 size={9} />
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024)       return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const LANG_COLORS: Record<string, string> = {
  python: "#3B82F6", bash: "#10B981", javascript: "#F59E0B", rust: "#EF4444",
};

const DEMO_REPOS: Repo[] = [
  {
    id: "r1", name: "phantom-scanner",
    description: "Distributed port scanner with AI-driven banner analysis.",
    language: "python", tags: ["recon", "scanner"], is_public: true, is_archived: false,
    star_count: 128, version: "2.3.1", commit_count: 47, is_starred: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "0xPhantom", username: "phantom", rank: "Legend" },
  },
  {
    id: "r2", name: "dns-exfil-toolkit",
    description: "Modular DNS exfiltration framework with multiple encoding schemes.",
    language: "python", tags: ["dns", "exfil"], is_public: true, is_archived: false,
    star_count: 86, version: "1.1.0", commit_count: 23, is_starred: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    owner: { full_name: "DeepSea_9", username: "deepsea9", rank: "Hacker" },
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

type Panel = "idle" | "new-repo" | "new-file";

export default function ReposPage() {
  // ── Repo state ──
  const [tab, setTab]             = React.useState<"mine" | "explore">("mine");
  const [repos, setRepos]         = React.useState<Repo[]>([]);
  const [exploreRepos, setExplore]= React.useState<Repo[]>(DEMO_REPOS);
  const [reposLoading, setRLoading] = React.useState(false);
  const [search, setSearch]       = React.useState("");
  const [selected, setSelected]   = React.useState<Repo | null>(null);

  // ── File state ──
  const [files, setFiles]         = React.useState<RepoFile[]>([]);
  const [filesLoading, setFLoading] = React.useState(false);
  const [selectedFile, setSelFile]= React.useState<RepoFile | null>(null);
  const [deletingFile, setDelFile]= React.useState<string | null>(null);

  // ── Panel state ──
  const [panel, setPanel]         = React.useState<Panel>("idle");

  // ── New Repo form ──
  const [repoForm, setRepoForm]   = React.useState({
    name: "", description: "", language: "python", tags: "", is_public: false,
  });
  const [repoSaving, setRepoSave] = React.useState(false);
  const [repoError, setRepoErr]   = React.useState<string | null>(null);

  // ── New File form ──
  const [filePath, setFilePath]   = React.useState("");
  const [fileContent, setFileCnt] = React.useState("");
  const [fileSaving, setFileSave] = React.useState(false);
  const [fileError, setFileErr]   = React.useState<string | null>(null);

  // ── Load my repos ──────────────────────────────────────────────────────────
  const loadRepos = React.useCallback(async () => {
    setRLoading(true);
    try {
      const res  = await fetch("/api/repos?mine=true&limit=50");
      const data = await res.json() as { ok: boolean; repos?: Repo[] };
      if (data.ok && data.repos) setRepos(data.repos);
    } catch {
      // keep empty
    } finally {
      setRLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadRepos(); }, [loadRepos]);

  // ── Load files for selected repo ───────────────────────────────────────────
  const loadFiles = React.useCallback(async (repoId: string) => {
    setFLoading(true);
    setFiles([]);
    setSelFile(null);
    try {
      const res  = await fetch(`/api/repos/files?repo_id=${repoId}`);
      const data = await res.json() as { ok: boolean; files?: RepoFile[] };
      if (data.ok && data.files) setFiles(data.files);
    } catch {
      // silent
    } finally {
      setFLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (selected) void loadFiles(selected.id);
    else { setFiles([]); setSelFile(null); }
  }, [selected, loadFiles]);

  // ── Create repo ────────────────────────────────────────────────────────────
  const createRepo = async () => {
    if (!repoForm.name.trim()) return;
    setRepoSave(true);
    setRepoErr(null);
    try {
      const res  = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...repoForm,
          tags: repoForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json() as { ok: boolean; repo?: Repo; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Failed to create repo");
      setRepos((p) => [data.repo!, ...p]);
      setSelected(data.repo!);
      setPanel("idle");
      setRepoForm({ name: "", description: "", language: "python", tags: "", is_public: false });
    } catch (e) {
      setRepoErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRepoSave(false);
    }
  };

  // ── Upload file ────────────────────────────────────────────────────────────
  const uploadFile = async () => {
    if (!selected || !filePath.trim()) return;
    setFileSave(true);
    setFileErr(null);
    try {
      const enc  = new TextEncoder();
      const buf  = enc.encode(fileContent);
      const b64  = btoa(String.fromCharCode(...Array.from(buf)));
      const name = filePath.split("/").pop() ?? filePath;

      const res  = await fetch("/api/repos/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_id:   selected.id,
          path:      filePath.startsWith("/") ? filePath.slice(1) : filePath,
          name,
          data:      b64,
          mime_type: "text/plain",
        }),
      });
      const data = await res.json() as { ok: boolean; file?: RepoFile; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      setFiles((p) => {
        const exists = p.findIndex((f) => f.id === data.file!.id);
        return exists >= 0 ? p.map((f, i) => (i === exists ? data.file! : f)) : [...p, data.file!];
      });
      setPanel("idle");
      setFilePath("");
      setFileCnt("");
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setFileSave(false);
    }
  };

  // ── Delete file ────────────────────────────────────────────────────────────
  const deleteFile = async (file: RepoFile) => {
    setDelFile(file.id);
    try {
      await fetch(`/api/repos/files?id=${file.id}`, { method: "DELETE" });
      setFiles((p) => p.filter((f) => f.id !== file.id));
      if (selectedFile?.id === file.id) setSelFile(null);
    } finally {
      setDelFile(null);
    }
  };

  // ── ZIP download ───────────────────────────────────────────────────────────
  const downloadZip = () => {
    if (!selected) return;
    window.open(`/api/repos/zip/${selected.id}`, "_blank");
  };

  // ── Star toggle ────────────────────────────────────────────────────────────
  const toggleStar = async (repo: Repo) => {
    try {
      const res = await fetch("/api/repos/star", {
        method: repo.is_starred ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id }),
      });
      const data = await res.json() as { ok: boolean; starred: boolean; star_count: number };
      if (data.ok) {
        const update = (list: Repo[]) =>
          list.map((r) => r.id === repo.id ? { ...r, is_starred: data.starred, star_count: data.star_count } : r);
        setRepos(update);
        setExplore(update);
      }
    } catch { /* silent */ }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const visibleRepos = (tab === "mine" ? repos : exploreRepos).filter((r) => {
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q));
  });

  const tree = React.useMemo(() => buildTree(files), [files]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#050505" }}>

      {/* ── COL 1: Repo sidebar ──────────────────────────────────────────────── */}
      <div
        className="flex w-64 shrink-0 flex-col border-r"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="text-[#D1FF00]" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white">
              Hacker-Git
            </span>
          </div>
          <button
            onClick={() => { setPanel("new-repo"); setSelected(null); }}
            className="flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-[#D1FF00]/10"
            title="New Repository"
          >
            <Plus size={12} className="text-[#D1FF00]" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(["mine", "explore"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative flex-1 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: tab === t ? "#D1FF00" : "#4B5563" }}
            >
              {t === "mine" ? "My Repos" : "Explore"}
              {tab === t && (
                <motion.div
                  layoutId="sidebar-tab"
                  className="absolute bottom-0 left-0 right-0 h-[1px]"
                  style={{ background: "#D1FF00" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="relative m-2"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4B5563]" />
          <input
            className="w-full bg-transparent py-1.5 pl-7 pr-2 font-mono text-[11px] text-white placeholder:text-[#374151] focus:outline-none"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto">
          {reposLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[#D1FF00]" />
            </div>
          ) : visibleRepos.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-[11px] text-[#374151]">
              {tab === "mine" ? "No repos yet" : "No results"}
            </div>
          ) : (
            visibleRepos.map((repo) => {
              const isActive = selected?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  onClick={() => { setSelected(repo); setPanel("idle"); }}
                  className="group w-full px-3 py-2.5 text-left transition-colors"
                  style={{
                    background:   isActive ? "rgba(209,255,0,0.07)" : "transparent",
                    borderLeft:   isActive ? "2px solid #D1FF00" : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: LANG_COLORS[repo.language] ?? "#6B7280" }}
                    />
                    <span
                      className="flex-1 truncate font-mono text-[12px] font-medium transition-colors"
                      style={{ color: isActive ? "#D1FF00" : "#D1D5DB" }}
                    >
                      {repo.name}
                    </span>
                    {repo.is_archived && <Archive size={9} className="text-[#4B5563]" />}
                    {repo.is_public
                      ? <Globe2 size={9} className="text-[#374151]" />
                      : <Lock size={9} className="text-[#374151]" />
                    }
                  </div>
                  <div className="flex items-center gap-3 pl-3.5">
                    <span className="font-mono text-[10px] text-[#4B5563] flex items-center gap-1">
                      <Star size={8} className={repo.is_starred ? "fill-[#D1FF00] text-[#D1FF00]" : ""} />
                      {repo.star_count}
                    </span>
                    <span className="font-mono text-[10px] text-[#374151]">v{repo.version}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── COL 2: File tree ─────────────────────────────────────────────────── */}
      <div
        className="flex w-56 shrink-0 flex-col border-r"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* File tree header */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#4B5563]">
            {selected ? selected.name : "Files"}
          </span>
          {selected && (
            <div className="flex items-center gap-1">
              <button
                onClick={downloadZip}
                className="flex h-6 items-center gap-1 px-1.5 font-mono text-[10px] text-[#6B7280] transition-colors hover:text-[#D1FF00]"
                title="Download as ZIP"
              >
                <Download size={10} />
              </button>
              <button
                onClick={() => setPanel("new-file")}
                className="flex h-6 items-center gap-1 px-1.5 font-mono text-[10px] text-[#6B7280] transition-colors hover:text-[#D1FF00]"
                title="New File"
              >
                <Plus size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Tree body */}
        <div className="flex-1 overflow-y-auto py-1">
          {!selected ? (
            <p className="px-4 py-6 font-mono text-[10px] text-[#374151]">Select a repo →</p>
          ) : filesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={14} className="animate-spin text-[#D1FF00]" />
            </div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="font-mono text-[10px] text-[#374151]">No files</p>
              <button
                onClick={() => setPanel("new-file")}
                className="mt-2 flex mx-auto items-center gap-1 font-mono text-[10px] text-[#D1FF00]"
              >
                <Plus size={9} /> Add file
              </button>
            </div>
          ) : (
            tree.map((node) => (
              <TreeNodeView
                key={node.path}
                node={node}
                selected={selectedFile}
                onSelect={setSelFile}
                onDelete={(f) => { void deleteFile(f); }}
              />
            ))
          )}
        </div>

        {/* ZIP + New File footer buttons */}
        {selected && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={downloadZip}
              className="flex w-full items-center gap-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#6B7280] transition-colors hover:text-[#D1FF00]"
            >
              <Download size={11} />
              Download Bundle
            </button>
            <button
              onClick={() => setPanel("new-file")}
              className="flex w-full items-center gap-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#6B7280] transition-colors hover:text-[#D1FF00]"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <Upload size={11} />
              Upload File
            </button>
          </div>
        )}
      </div>

      {/* ── COL 3: Main panel ────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">

          {/* New Repo panel */}
          {panel === "new-repo" && (
            <motion.div
              key="new-repo"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-[#D1FF00]" />
                  <span className="font-mono text-[13px] font-semibold uppercase tracking-widest text-white">
                    New Repository
                  </span>
                </div>
                <button onClick={() => setPanel("idle")} className="text-[#4B5563] hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {[
                  { k: "name",        label: "Name",        ph: "my-exploit-toolkit" },
                  { k: "description", label: "Description", ph: "What does this repo do?" },
                ].map(({ k, label, ph }) => (
                  <div key={k} className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">{label}</label>
                    <input
                      className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                      placeholder={ph}
                      value={repoForm[k as keyof typeof repoForm] as string}
                      onChange={(e) => setRepoForm((p) => ({ ...p, [k]: e.target.value }))}
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
                        value={repoForm.language}
                        onChange={(e) => setRepoForm((p) => ({ ...p, language: e.target.value }))}
                      >
                        {["python", "bash", "javascript", "rust"].map((l) => (
                          <option key={l} value={l} className="bg-[#0A0A0A]">{l}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Visibility</label>
                    <button
                      onClick={() => setRepoForm((p) => ({ ...p, is_public: !p.is_public }))}
                      className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[12px] transition-all"
                      style={{
                        border: "1px solid",
                        borderColor: repoForm.is_public ? "rgba(209,255,0,0.3)" : "rgba(255,255,255,0.08)",
                        color: repoForm.is_public ? "#D1FF00" : "#6B7280",
                        background: repoForm.is_public ? "rgba(209,255,0,0.06)" : "transparent",
                      }}
                    >
                      {repoForm.is_public ? <Globe2 size={12} /> : <Lock size={12} />}
                      {repoForm.is_public ? "Public" : "Private"}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Tags (comma-separated)</label>
                  <input
                    className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="recon, ssrf, bypass"
                    value={repoForm.tags}
                    onChange={(e) => setRepoForm((p) => ({ ...p, tags: e.target.value }))}
                  />
                </div>

                {repoError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 font-mono text-[12px] text-[#EF4444]"
                    style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
                  >
                    <AlertCircle size={12} /> {repoError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  disabled={repoSaving || !repoForm.name.trim()}
                  onClick={() => void createRepo()}
                  className="flex w-full items-center justify-center gap-2 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40"
                  style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
                >
                  {repoSaving
                    ? <><Loader2 size={12} className="animate-spin" />Creating…</>
                    : <><Plus size={12} />Create Repository</>
                  }
                </button>
              </div>
            </motion.div>
          )}

          {/* New File panel */}
          {panel === "new-file" && selected && (
            <motion.div
              key="new-file"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-[#D1FF00]" />
                  <span className="font-mono text-[13px] font-semibold uppercase tracking-widest text-white">
                    New File — {selected.name}
                  </span>
                </div>
                <button onClick={() => setPanel("idle")} className="text-[#4B5563] hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">
                    File Path (e.g. src/scanner.py)
                  </label>
                  <input
                    className="w-full bg-transparent px-3 py-2 font-mono text-[13px] text-white placeholder:text-[#374151] focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="src/main.py"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                  />
                </div>

                <div className="flex-1 flex flex-col space-y-1 overflow-hidden">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Content</label>
                  <textarea
                    className="flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12px] text-[#D1D5DB] placeholder:text-[#374151] focus:outline-none leading-relaxed"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder={"#!/usr/bin/env python3\n# Write your script here…"}
                    value={fileContent}
                    onChange={(e) => setFileCnt(e.target.value)}
                    spellCheck={false}
                  />
                </div>

                {fileError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 font-mono text-[12px] text-[#EF4444]"
                    style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
                  >
                    <AlertCircle size={12} /> {fileError}
                  </div>
                )}

                <button
                  disabled={fileSaving || !filePath.trim()}
                  onClick={() => void uploadFile()}
                  className="flex items-center justify-center gap-2 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40"
                  style={{ background: "rgba(209,255,0,0.1)", color: "#D1FF00", border: "1px solid rgba(209,255,0,0.3)" }}
                >
                  {fileSaving
                    ? <><Loader2 size={12} className="animate-spin" />Uploading…</>
                    : <><Upload size={12} />Save File</>
                  }
                </button>
              </div>
            </motion.div>
          )}

          {/* File viewer */}
          {panel === "idle" && selectedFile && (
            <motion.div
              key={`file-${selectedFile.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-6 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={12} className="shrink-0 text-[#D1FF00]" />
                  <span className="font-mono text-[12px] text-white truncate">{selectedFile.path}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono text-[10px] text-[#4B5563]">
                  <span>{fmtBytes(selectedFile.size_bytes)}</span>
                  <span>{selectedFile.mime_type}</span>
                  <button
                    onClick={() => { void deleteFile(selectedFile); }}
                    disabled={deletingFile === selectedFile.id}
                    className="flex items-center gap-1 px-2 py-1 text-[#4B5563] transition-colors hover:text-[#EF4444] disabled:opacity-40"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {deletingFile === selectedFile.id
                      ? <Loader2 size={10} className="animate-spin" />
                      : <Trash2 size={10} />
                    }
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-2 gap-4 font-mono text-[11px]">
                  {[
                    { label: "Path",     value: selectedFile.path },
                    { label: "Size",     value: fmtBytes(selectedFile.size_bytes) },
                    { label: "Type",     value: selectedFile.mime_type },
                    { label: "Created",  value: new Date(selectedFile.created_at).toLocaleString() },
                    { label: "Updated",  value: new Date(selectedFile.updated_at).toLocaleString() },
                    { label: "Key",      value: selectedFile.storage_key },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-0.5">
                      <span className="text-[#4B5563] uppercase tracking-widest text-[10px]">{label}</span>
                      <p className="text-[#9CA3AF] break-all">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {panel === "idle" && !selectedFile && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
            >
              {selected ? (
                <>
                  <Folder size={36} className="text-[#1F2937]" />
                  <div>
                    <p className="font-mono text-[13px] text-[#374151]">{selected.name}</p>
                    <p className="font-mono text-[11px] text-[#1F2937] mt-1">
                      {files.length === 0 ? "No files yet — upload one to get started" : "Select a file from the tree"}
                    </p>
                  </div>
                  {files.length === 0 && (
                    <button
                      onClick={() => setPanel("new-file")}
                      className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-[#D1FF00] transition-all"
                      style={{ border: "1px solid rgba(209,255,0,0.2)" }}
                    >
                      <Upload size={11} /> Upload File
                    </button>
                  )}
                </>
              ) : (
                <>
                  <GitBranch size={36} className="text-[#1F2937]" />
                  <div>
                    <p className="font-mono text-[13px] text-[#374151]">No repository selected</p>
                    <p className="font-mono text-[11px] text-[#1F2937] mt-1">
                      Choose a repo from the sidebar or create a new one
                    </p>
                  </div>
                  <button
                    onClick={() => setPanel("new-repo")}
                    className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-[#D1FF00]"
                    style={{ border: "1px solid rgba(209,255,0,0.2)" }}
                  >
                    <Plus size={11} /> New Repository
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
