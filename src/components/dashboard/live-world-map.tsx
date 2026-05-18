"use client";

/**
 * LiveWorldMap
 * ────────────────────────────────────────────────────────────────────────────
 * Animated SVG world map for the Admin operations console.
 * Shows all known PoP/data-centre nodes as dormant dots.  When scans are
 * active, a subset of nodes lights up with SMIL-driven pulse-ring animations.
 * Supabase Realtime flashes an additional random node every time a new
 * `scan_logs` finding is inserted, keeping the map live.
 *
 * Design notes:
 *  – 1000 × 500 SVG viewport, Mercator-ish proportions.
 *  – Land masses use simplified polygon paths — recognisable, not accurate.
 *  – Active nodes: two concentric expanding rings + core dot (acid #D1FF00).
 *  – Zero canvas/WebGL — pure SVG SMIL; works everywhere.
 */

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveWorldMapProps {
  /** Count of currently queued/probing scans from the server render. */
  activeScans: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

/** Global PoP / data-centre coordinates in the 1000 × 500 SVG viewport. */
const NODES = [
  { id: "sea",  x: 85,  y: 128 },   // Seattle
  { id: "sfo",  x: 82,  y: 168 },   // San Francisco
  { id: "lax",  x: 78,  y: 182 },   // Los Angeles
  { id: "chi",  x: 156, y: 142 },   // Chicago
  { id: "iad",  x: 175, y: 152 },   // Ashburn (AWS us-east-1)
  { id: "nyc",  x: 180, y: 148 },   // New York
  { id: "yyz",  x: 172, y: 132 },   // Toronto
  { id: "gru",  x: 202, y: 358 },   // São Paulo
  { id: "bog",  x: 168, y: 295 },   // Bogotá
  { id: "lhr",  x: 448, y: 92  },   // London
  { id: "dub",  x: 432, y: 88  },   // Dublin
  { id: "ams",  x: 468, y: 87  },   // Amsterdam
  { id: "fra",  x: 487, y: 97  },   // Frankfurt
  { id: "par",  x: 460, y: 100 },   // Paris
  { id: "mad",  x: 448, y: 118 },   // Madrid
  { id: "mil",  x: 478, y: 108 },   // Milan
  { id: "sto",  x: 492, y: 72  },   // Stockholm
  { id: "war",  x: 502, y: 88  },   // Warsaw
  { id: "jnb",  x: 512, y: 385 },   // Johannesburg
  { id: "nbo",  x: 548, y: 298 },   // Nairobi
  { id: "dxb",  x: 598, y: 198 },   // Dubai
  { id: "del",  x: 645, y: 188 },   // Delhi
  { id: "bom",  x: 648, y: 215 },   // Mumbai
  { id: "sin",  x: 730, y: 268 },   // Singapore
  { id: "hkg",  x: 790, y: 208 },   // Hong Kong
  { id: "sha",  x: 808, y: 168 },   // Shanghai
  { id: "sel",  x: 824, y: 145 },   // Seoul
  { id: "nrt",  x: 845, y: 152 },   // Tokyo
  { id: "syd",  x: 845, y: 372 },   // Sydney
] as const;

type NodeId = (typeof NODES)[number]["id"];

/**
 * Simplified continent/island polygon paths in the 1000 × 500 SVG viewport.
 * These are stylised outlines — visually recognisable, not cartographically
 * accurate.
 */
const LAND_PATHS: string[] = [
  // ── North America ──────────────────────────────────────────────────────────
  "M 58,52 L 120,42 L 185,48 L 228,62 L 255,88 L 258,125 L 244,168 L 222,212 L 200,248 L 178,272 L 158,285 L 138,268 L 118,252 L 102,235 L 88,212 L 75,182 L 62,152 L 52,118 L 50,88 Z",
  // ── Greenland ──────────────────────────────────────────────────────────────
  "M 288,25 L 340,18 L 378,28 L 396,52 L 378,75 L 342,86 L 305,76 L 285,52 Z",
  // ── Central America bridge ─────────────────────────────────────────────────
  "M 155,268 L 178,270 L 192,278 L 180,290 L 160,288 Z",
  // ── South America ──────────────────────────────────────────────────────────
  "M 158,290 L 196,280 L 240,284 L 270,306 L 280,348 L 278,388 L 260,432 L 228,455 L 195,452 L 168,434 L 152,404 L 146,364 L 148,322 Z",
  // ── Scandinavia ────────────────────────────────────────────────────────────
  "M 468,55 L 498,48 L 516,58 L 510,76 L 495,82 L 472,76 Z",
  // ── UK + Ireland ───────────────────────────────────────────────────────────
  "M 436,74 L 452,70 L 462,78 L 458,96 L 446,100 L 436,92 Z",
  // ── Continental Europe ─────────────────────────────────────────────────────
  "M 428,60 L 462,54 L 505,55 L 536,66 L 548,86 L 548,112 L 530,132 L 506,142 L 478,146 L 450,136 L 432,115 L 426,92 Z",
  // ── Africa ─────────────────────────────────────────────────────────────────
  "M 425,172 L 478,165 L 536,168 L 570,186 L 592,222 L 600,270 L 595,322 L 575,376 L 545,416 L 505,432 L 462,428 L 432,402 L 415,358 L 410,305 L 412,248 L 418,208 Z",
  // ── Arabian Peninsula ──────────────────────────────────────────────────────
  "M 540,138 L 592,130 L 628,140 L 640,162 L 622,180 L 582,188 L 550,178 Z",
  // ── Russia + Central Asia ──────────────────────────────────────────────────
  "M 528,52 L 642,40 L 762,42 L 858,52 L 898,70 L 902,96 L 878,118 L 820,130 L 752,124 L 688,120 L 626,128 L 580,136 L 545,128 L 528,105 Z",
  // ── Indian Subcontinent ────────────────────────────────────────────────────
  "M 618,172 L 685,165 L 722,174 L 730,212 L 712,246 L 682,258 L 650,250 L 630,228 L 618,200 Z",
  // ── Southeast Asia mainland ───────────────────────────────────────────────
  "M 720,172 L 778,165 L 812,178 L 828,212 L 812,246 L 778,258 L 742,250 L 722,228 Z",
  // ── East Asia coastal extension ────────────────────────────────────────────
  "M 812,165 L 842,155 L 868,168 L 862,196 L 840,208 L 818,198 Z",
  // ── Japan main island ──────────────────────────────────────────────────────
  "M 836,132 L 858,128 L 870,142 L 864,162 L 848,168 L 835,158 Z",
  // ── SE Asia island arc ────────────────────────────────────────────────────
  "M 722,265 L 768,258 L 802,266 L 815,278 L 792,285 L 752,282 L 725,275 Z",
  // ── Australia ─────────────────────────────────────────────────────────────
  "M 728,305 L 808,295 L 878,310 L 908,345 L 905,390 L 875,422 L 825,434 L 772,426 L 738,406 L 718,368 L 716,335 Z",
  // ── New Zealand ───────────────────────────────────────────────────────────
  "M 918,375 L 932,368 L 940,382 L 932,398 L 920,392 Z",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tiny LCG so the initial pulse selection is deterministic (same seed → same nodes). */
function lcgRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

function pickActiveIds(count: number, seed: number): NodeId[] {
  if (count === 0) return [];
  const rng = lcgRandom(seed);
  const shuffled = [...NODES].sort(() => rng() - 0.5);
  return shuffled
    .slice(0, Math.min(count + 2, NODES.length))
    .map((n) => n.id);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveWorldMap({ activeScans }: LiveWorldMapProps) {
  const [activeIds, setActiveIds] = React.useState<NodeId[]>(() =>
    pickActiveIds(activeScans, 0xf06e42),
  );

  // Re-pick when the server-supplied count changes
  React.useEffect(() => {
    setActiveIds(pickActiveIds(activeScans, Date.now() % 99991));
  }, [activeScans]);

  // Supabase Realtime — add a random node flash on each new finding
  React.useEffect(() => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createBrowserClient(url, key);

    const channel = supabase
      .channel("live-map:scan_logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_logs",
          filter: "type=eq.finding",
        },
        () => {
          setActiveIds((prev) => {
            const candidate = NODES[Math.floor(Math.random() * NODES.length)];
            if (!candidate || prev.includes(candidate.id)) return prev;
            // Cap at 10 simultaneous pulses
            return [...prev.slice(-9), candidate.id];
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  const activeNodes = NODES.filter((n) => activeIds.includes(n.id as NodeId));

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-xs">
      {/* Subtle CRT scanline texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.022]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,1) 2px,rgba(255,255,255,1) 3px)",
        }}
      />

      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          {/* Land-mass glow */}
          <filter id="fgg-land" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Active-node glow */}
          <filter id="fgg-node" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Dot grid background ─────────────────────────────────────────── */}
        {Array.from({ length: 28 }, (_, col) =>
          Array.from({ length: 14 }, (_, row) => (
            <circle
              key={`g${col}-${row}`}
              cx={col * 37 + 6}
              cy={row * 37 + 6}
              r="0.85"
              fill="rgba(255,255,255,0.068)"
            />
          )),
        )}

        {/* ── Continent fills ─────────────────────────────────────────────── */}
        {LAND_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="rgba(255,255,255,0.036)"
            stroke="rgba(255,255,255,0.092)"
            strokeWidth="0.7"
            strokeLinejoin="round"
            filter="url(#fgg-land)"
          />
        ))}

        {/* ── Dormant node dots ───────────────────────────────────────────── */}
        {NODES.map((n) => (
          <circle
            key={`d-${n.id}`}
            cx={n.x}
            cy={n.y}
            r="1.4"
            fill="rgba(255,255,255,0.14)"
          />
        ))}

        {/* ── Active pulsing nodes ────────────────────────────────────────── */}
        {activeNodes.map((n, i) => {
          const delay1 = ((i * 0.42) % 2.4).toFixed(2);
          const delay2 = ((i * 0.42 + 0.55) % 2.4).toFixed(2);
          const coreDelay = ((i * 0.31) % 1.8).toFixed(2);
          return (
            <g key={`a-${n.id}`} filter="url(#fgg-node)">
              {/* Outer expanding ring */}
              <circle
                cx={n.x}
                cy={n.y}
                r="3"
                fill="none"
                stroke="#d1ff00"
                strokeWidth="0.72"
              >
                <animate
                  attributeName="r"
                  values="3;24"
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${delay1}s`}
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.75;0"
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${delay1}s`}
                />
              </circle>
              {/* Inner tight ring */}
              <circle
                cx={n.x}
                cy={n.y}
                r="2"
                fill="none"
                stroke="#d1ff00"
                strokeWidth="0.5"
              >
                <animate
                  attributeName="r"
                  values="2;14"
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${delay2}s`}
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.45;0"
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${delay2}s`}
                />
              </circle>
              {/* Core dot */}
              <circle cx={n.x} cy={n.y} r="2.5" fill="#d1ff00">
                <animate
                  attributeName="fill-opacity"
                  values="1;0.52;1"
                  dur="1.8s"
                  repeatCount="indefinite"
                  begin={`${coreDelay}s`}
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* ── Status badge ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
        {activeScans > 0 ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-55" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-acid" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-acid/80">
              {activeScans}&nbsp;scan{activeScans !== 1 ? "s" : ""}&nbsp;live
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-foreground-subtle/20" />
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-foreground-subtle/35">
              idle — no active scans
            </span>
          </>
        )}
      </div>
    </div>
  );
}
