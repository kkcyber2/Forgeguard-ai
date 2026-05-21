"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Play,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeType = "dns" | "ports" | "record" | "port" | "root" | string;

interface SurfaceNode {
  id: string;
  label: string;
  type: NodeType;
  children: string[];
}

interface SurfaceMap {
  root: string;
  nodes: SurfaceNode[];
}

type ReconStatus = "queued" | "running" | "done" | "failed";

interface ReconRow {
  id: string;
  target: string;
  status: ReconStatus;
  surface_map: SurfaceMap | null;
  scan_depth: number;
  created_at: string;
  completed_at: string | null;
}

// ─── Demo surface map ─────────────────────────────────────────────────────────

const DEMO_MAP: SurfaceMap = {
  root: "example.com",
  nodes: [
    { id: "dns", label: "DNS Records", type: "dns", children: ["a_record", "mx_record", "ns_record"] },
    { id: "a_record", label: "A: 93.184.216.34", type: "record", children: [] },
    { id: "mx_record", label: "MX: mail.example.com", type: "record", children: [] },
    { id: "ns_record", label: "NS: ns1.example.com", type: "record", children: [] },
    { id: "ports", label: "Open Ports", type: "ports", children: ["port_80", "port_443", "port_22"] },
    { id: "port_80", label: "HTTP :80", type: "port", children: [] },
    { id: "port_443", label: "HTTPS :443", type: "port", children: [] },
    { id: "port_22", label: "SSH :22", type: "port", children: [] },
    { id: "subdomains", label: "Subdomains", type: "dns", children: ["sub_www", "sub_api"] },
    { id: "sub_www", label: "www.example.com", type: "record", children: [] },
    { id: "sub_api", label: "api.example.com", type: "record", children: [] },
  ],
};

// ─── SVG Tree layout ──────────────────────────────────────────────────────────

const NODE_W = 120;
const NODE_H = 28;
const H_GAP = 56;
const V_GAP = 10;

interface LayoutNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  children: string[];
}

function layoutTree(map: SurfaceMap): LayoutNode[] {
  const allNodes: SurfaceNode[] = [
    { id: "__root__", label: map.root, type: "root", children: [] },
    ...map.nodes,
  ];

  const allChildIds = new Set(map.nodes.flatMap((n) => n.children));
  const topLevel = map.nodes.filter((n) => !allChildIds.has(n.id)).map((n) => n.id);
  allNodes[0].children = topLevel;

  const nodeMap = new Map<string, SurfaceNode>(allNodes.map((n) => [n.id, n]));

  const subtreeHeight = (id: string): number => {
    const node = nodeMap.get(id);
    if (!node || node.children.length === 0) return NODE_H;
    const childHeights = node.children.map(subtreeHeight);
    const totalChildH = childHeights.reduce((a, b) => a + b, 0);
    return Math.max(NODE_H, totalChildH + (node.children.length - 1) * V_GAP);
  };

  const positions: LayoutNode[] = [];

  const place = (id: string, depth: number, midY: number) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const x = depth * (NODE_W + H_GAP);
    const y = midY - NODE_H / 2;
    positions.push({ ...node, x, y });
    if (node.children.length === 0) return;
    const childHeights = node.children.map(subtreeHeight);
    const totalH = childHeights.reduce((a, b) => a + b, 0) + (node.children.length - 1) * V_GAP;
    let cursor = midY - totalH / 2;
    node.children.forEach((cid, i) => {
      const ch = childHeights[i];
      place(cid, depth + 1, cursor + ch / 2);
      cursor += ch + V_GAP;
    });
  };

  place("__root__", 0, 0);

  const minY = Math.min(...positions.map((p) => p.y));
  return positions.map((p) => ({ ...p, y: p.y - minY + 8 }));
}

function SurfaceTree({ map }: { map: SurfaceMap }) {
  const nodes = layoutTree(map);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_W + 8;
  const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_H + 8;

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  nodes.forEach((n) => {
    n.children.forEach((cid) => {
      const child = nodeMap.get(cid);
      if (!child) return;
      edges.push({ x1: n.x + NODE_W, y1: n.y + NODE_H / 2, x2: child.x, y2: child.y + NODE_H / 2 });
    });
  });

  const nodeStyle = (type: NodeType) => {
    if (type === "root") return { fill: "#0F1011", stroke: "#D1FF00", strokeWidth: 1 };
    if (type === "record" || type === "port") return { fill: "#0F1011", stroke: "#3B4048", strokeWidth: 0.5 };
    return { fill: "#0F1011", stroke: "#D1FF00", strokeWidth: 0.7 };
  };

  const textColor = (type: NodeType) =>
    type === "record" || type === "port" ? "#6B7280" : "#CBD5E1";

  return (
    <div className="overflow-x-auto rounded-sm border border-steel-900/60">
      <svg
        width={maxX}
        height={maxY}
        viewBox={`0 0 ${maxX} ${maxY}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", minWidth: maxX }}
      >
        {edges.map((e, i) => {
          const mx = (e.x1 + e.x2) / 2;
          return (
            <path
              key={i}
              d={`M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`}
              fill="none"
              stroke="#D1FF00"
              strokeOpacity="0.3"
              strokeWidth="1"
            />
          );
        })}
        {nodes.map((n) => {
          const s = nodeStyle(n.type);
          const tc = textColor(n.type);
          const label = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;
          return (
            <g key={n.id}>
              <rect
                x={n.x} y={n.y} width={NODE_W} height={NODE_H}
                rx={3} ry={3}
                fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth}
              />
              <text
                x={n.x + 8} y={n.y + NODE_H / 2 + 4}
                fontFamily="monospace" fontSize="10" fill={tc}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReconStatus }) {
  const map: Record<ReconStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    queued: {
      label: "QUEUED",
      cls: "text-steel-400 border-steel-700/50 bg-steel-900/30",
      icon: <Clock size={9} />,
    },
    running: {
      label: "RUNNING",
      cls: "text-acid border-acid/30 bg-acid/5 animate-pulse",
      icon: <Loader2 size={9} className="animate-spin" />,
    },
    done: {
      label: "DONE",
      cls: "text-acid border-acid/40 bg-acid/10",
      icon: <CheckCircle2 size={9} />,
    },
    failed: {
      label: "FAILED",
      cls: "text-threat border-threat/30 bg-threat/5",
      icon: <XCircle size={9} />,
    },
  };

  const { label, cls, icon } = map[status] ?? map.queued;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-widest",
      cls,
    )}>
      {icon}
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReconPage() {
  const [target, setTarget] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeSurface, setActiveSurface] = React.useState<SurfaceMap>(DEMO_MAP);
  const [isDemo, setIsDemo] = React.useState(true);
  const [history, setHistory] = React.useState<ReconRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/recon/list");
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && Array.isArray(json.recons)) setHistory(json.recons);
      } catch {
        // Non-fatal
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), depth: 2 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { setError(json.error ?? "Recon request failed."); return; }
      const newRow: ReconRow = { ...json.recon, surface_map: json.recon.surface_map ?? null };
      setHistory((prev) => [newRow, ...prev]);
      if (newRow.surface_map) { setActiveSurface(newRow.surface_map); setIsDemo(false); }
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleViewMap(row: ReconRow) {
    if (row.surface_map) { setActiveSurface(row.surface_map); setIsDemo(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Radar size={16} className="text-acid" />
          <h1 className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-steel-100">
            RECON INFRASTRUCTURE
          </h1>
        </div>
        <p className="font-mono text-[11px] text-steel-500">
          Target Surface Map — AI-driven OSINT enumeration.
        </p>
      </div>

      {/* Target Input */}
      <div className="rounded-sm border border-steel-900/80 bg-obsidian-900/60 p-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-steel-500">New Recon Job</p>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="domain.com  /  192.168.1.1  /  https://target.io"
              disabled={loading}
              className={cn(
                "w-full rounded-sm border border-steel-900 bg-obsidian-950 px-3 py-2",
                "font-mono text-[12px] text-steel-200 placeholder:text-steel-700",
                "focus:border-acid/40 focus:outline-none focus:ring-0",
                "disabled:opacity-50",
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !target.trim()}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm border border-acid/40 bg-acid/10",
              "px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-acid",
              "transition-colors hover:bg-acid/20 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {loading ? (<><Loader2 size={12} className="animate-spin" />RUNNING&hellip;</>) : (<><Play size={11} />START RECON</>)}
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 rounded-sm border border-threat/30 bg-threat/5 px-3 py-2"
            >
              <AlertCircle size={12} className="shrink-0 text-threat" />
              <span className="font-mono text-[11px] text-threat">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Surface Map Tree */}
      <div className="rounded-sm border border-steel-900/80 bg-obsidian-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight size={12} className="text-acid" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
              Surface Map
              {isDemo && <span className="ml-2 text-steel-700">(demo — run a scan to populate)</span>}
            </p>
          </div>
          <span className="font-mono text-[10px] text-steel-600">root: {activeSurface.root}</span>
        </div>
        <SurfaceTree map={activeSurface} />
      </div>

      {/* Recon History Table */}
      <div className="rounded-sm border border-steel-900/80 bg-obsidian-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-500">Recon History</p>
          <button
            onClick={async () => {
              setHistoryLoading(true);
              try {
                const res = await fetch("/api/recon/list");
                const json = await res.json();
                if (json.ok) setHistory(json.recons ?? []);
              } finally { setHistoryLoading(false); }
            }}
            className="inline-flex items-center gap-1.5 rounded-sm border border-steel-900 px-2 py-1 font-mono text-[10px] text-steel-500 transition-colors hover:border-steel-700 hover:text-steel-300"
          >
            <RefreshCw size={9} />Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-8 text-steel-600">
            <Loader2 size={14} className="animate-spin" />
            <span className="ml-2 font-mono text-[11px]">Loading history&hellip;</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Radar size={24} className="text-steel-800" />
            <p className="font-mono text-[11px] text-steel-600">No recon jobs yet. Enter a target above to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-steel-900/60">
                  {["Target", "Status", "Depth", "Created", "Actions"].map((h) => (
                    <th key={h} className="pb-2 pr-6 text-left font-mono text-[9px] uppercase tracking-widest text-steel-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {history.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="border-b border-steel-900/30 last:border-0"
                    >
                      <td className="py-2.5 pr-6 font-mono text-[11px] text-steel-200">{row.target}</td>
                      <td className="py-2.5 pr-6"><StatusBadge status={row.status} /></td>
                      <td className="py-2.5 pr-6 font-mono text-[11px] text-steel-500">{row.scan_depth}</td>
                      <td className="py-2.5 pr-6 font-mono text-[11px] text-steel-600">
                        {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5">
                        {row.surface_map ? (
                          <button onClick={() => handleViewMap(row)} className="font-mono text-[10px] text-acid transition-colors hover:text-acid/70 underline underline-offset-2">View Map</button>
                        ) : (
                          <span className="font-mono text-[10px] text-steel-700">&mdash;</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
