"use client";

import * as React from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { createBrowserClient } from "@supabase/ssr";
import type { PopNodeId } from "@/lib/admin/resolve-scan-node";
import {
  nodeToGeo,
  resolveScanGeo,
  resolveScanNode,
} from "@/lib/admin/resolve-scan-node";
import type { LiveWorldMapProps } from "@/components/dashboard/live-world-map";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const countries110m = require("world-atlas/countries-110m.json") as Topology;

const WIDTH = 960;
const HEIGHT = 480;
const SCAN_COLOR = "#ADFF2F";
const ATTACK_COLOR = "#A020F0";

type Ping = { x: number; y: number; kind: "scan" | "attack"; id: string };

function loadLandFeatures(): {
  paths: string[];
  projection: ReturnType<typeof geoMercator>;
} {
  const land = feature(
    countries110m,
    countries110m.objects.countries as Parameters<typeof feature>[1],
  ) as unknown as FeatureCollection<Geometry>;
  const projection = geoMercator().fitSize([WIDTH, HEIGHT], land);
  const pathGen = geoPath(projection);
  const paths = land.features.map((f) => pathGen(f) ?? "").filter(Boolean);
  return { paths, projection };
}

export function TacticalWorldMap({
  activeScans,
  scanTargets = [],
  pulseNodeIds,
  dense = false,
  attackPulses = false,
}: LiveWorldMapProps) {
  const [landPaths, setLandPaths] = React.useState<string[]>([]);
  const [scanPings, setScanPings] = React.useState<Ping[]>([]);
  const [attackPings, setAttackPings] = React.useState<Ping[]>([]);
  const projectionRef = React.useRef<ReturnType<typeof geoMercator> | null>(null);
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  );

  React.useEffect(() => {
    const { paths, projection } = loadLandFeatures();
    setLandPaths(paths);
    projectionRef.current = projection;
  }, []);

  React.useEffect(() => {
    const proj = projectionRef.current ?? loadLandFeatures().projection;
    const pings: Ping[] = [];

    if (pulseNodeIds && pulseNodeIds.length > 0) {
      for (const nodeId of pulseNodeIds) {
        const geo = nodeToGeo(nodeId);
        const xy = proj([geo.lng, geo.lat]);
        if (xy) pings.push({ x: xy[0], y: xy[1], kind: "scan", id: nodeId });
      }
    } else if (scanTargets.length > 0) {
      scanTargets.forEach((s, i) => {
        const geo = resolveScanGeo(s.target_url, i);
        const xy = proj([geo.lng, geo.lat]);
        if (xy) pings.push({ x: xy[0], y: xy[1], kind: "scan", id: s.id });
      });
    } else if (activeScans > 0) {
      const nodes: PopNodeId[] = ["iad", "sfo", "lhr", "sin", "nrt"];
      nodes.slice(0, Math.min(activeScans, 5)).forEach((nodeId) => {
        const geo = nodeToGeo(nodeId);
        const xy = proj([geo.lng, geo.lat]);
        if (xy) pings.push({ x: xy[0], y: xy[1], kind: "scan", id: nodeId });
      });
    }

    setScanPings(pings);
  }, [activeScans, scanTargets, pulseNodeIds]);

  React.useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    let mounted = true;
    const supabase = createBrowserClient(url, key);
    const proj = projectionRef.current ?? loadLandFeatures().projection;

    const channel = supabase
      .channel(`tactical-map:events:${sessionIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_logs",
          filter: "type=eq.finding",
        },
        () => {
          if (!mounted) return;
          const nodeId = resolveScanNode("https://api.openai.com", Date.now());
          const geo = nodeToGeo(nodeId);
          const xy = proj([geo.lng, geo.lat]);
          if (!xy) return;
          const id = `scan-${Date.now()}`;
          setScanPings((prev) => [...prev.slice(-8), { x: xy[0], y: xy[1], kind: "scan", id }]);
        },
      );

    if (attackPulses) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attack_logs" },
        () => {
          if (!mounted) return;
          const nodeId = resolveScanNode("https://anthropic.com", Date.now() + 1);
          const geo = nodeToGeo(nodeId);
          const xy = proj([geo.lng, geo.lat]);
          if (!xy) return;
          const id = `atk-${Date.now()}`;
          setAttackPings((prev) => [...prev.slice(-4), { x: xy[0], y: xy[1], kind: "attack", id }]);
          setTimeout(() => {
            if (!mounted) return;
            setAttackPings((prev) => prev.filter((p) => p.id !== id));
          }, 2400);
        },
      );
    }

    channel.subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [attackPulses]);

  const heightClass = dense ? "h-[360px]" : "h-[220px]";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xs bg-[#050505] ${heightClass}`}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Tactical world map"
      >
        <rect width={WIDTH} height={HEIGHT} fill="#050505" />
        {landPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {scanPings.map((p) => (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <circle r={4} fill="none" stroke={SCAN_COLOR} strokeWidth={2} opacity={0.9}>
              <animate attributeName="r" values="2;10;2" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r={2} fill={SCAN_COLOR} />
          </g>
        ))}
        {attackPings.map((p) => (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <circle r={4} fill="none" stroke={ATTACK_COLOR} strokeWidth={2} opacity={0.95}>
              <animate attributeName="r" values="2;12;2" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.95;0;0.95" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r={2} fill={ATTACK_COLOR} />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-2 right-3 flex gap-3 font-mono text-[8px] uppercase tracking-widest text-white/35">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ADFF2F]" />
          Scans
        </span>
        {attackPulses && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#A020F0]" />
            Attacks
          </span>
        )}
      </div>
    </div>
  );
}
