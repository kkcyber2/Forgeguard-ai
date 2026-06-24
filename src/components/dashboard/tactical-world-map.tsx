"use client";

import * as React from "react";
import { geoMercator } from "d3-geo";
import { createBrowserClient } from "@supabase/ssr";
import worldMapData from "@/lib/geo/world-map-paths.json";
import {
  extractTargetUrlFromPayload,
  resolvePulseGeo,
} from "@/lib/live-map/geo";

const WIDTH = worldMapData.width;
const HEIGHT = worldMapData.height;
const LAND_PATHS = worldMapData.paths as string[];
const PROJ_META = worldMapData.projection as {
  translate: [number, number];
  scale: number;
  center: [number, number];
};
const SCAN_COLOR = "#ADFF2F";

function buildProjection() {
  return geoMercator()
    .translate(PROJ_META.translate)
    .scale(PROJ_META.scale)
    .center(PROJ_META.center);
}

export interface ScanTargetPulse {
  id: string;
  target_url: string;
}

export interface LiveWorldMapProps {
  scanTargets?: ScanTargetPulse[];
  scanTargetById?: Record<string, string>;
  dense?: boolean;
  /** When set, realtime breach/strike pulses are limited to this user's scans. */
  userId?: string | null;
}

type Ping = { x: number; y: number; id: string };

function TacticalWorldMapCanvas({
  scanTargets = [],
  scanTargetById = {},
  dense = false,
  userId = null,
}: LiveWorldMapProps) {
  const [pings, setPings] = React.useState<Ping[]>([]);
  const [visible, setVisible] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scanCacheRef = React.useRef(scanTargetById);
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  );

  React.useEffect(() => {
    scanCacheRef.current = { ...scanCacheRef.current, ...scanTargetById };
  }, [scanTargetById]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: "80px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    const proj = buildProjection();
    const next: Ping[] = [];
    scanTargets.forEach((s, i) => {
      const geo = resolvePulseGeo(s.target_url, i);
      if (!geo) return;
      const xy = proj([geo.lng, geo.lat]);
      if (xy) next.push({ x: xy[0], y: xy[1], id: s.id });
    });
    setPings(next);
  }, [scanTargets]);

  React.useEffect(() => {
    if (!visible) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    let mounted = true;
    const supabase = createBrowserClient(url, key);
    const proj = buildProjection();
    let allowedScanIds = new Set<string>();

    if (userId) {
      void supabase
        .from("scans")
        .select("id")
        .eq("user_id", userId)
        .then(({ data }) => {
          if (!mounted) return;
          allowedScanIds = new Set((data ?? []).map((s) => s.id));
        });
    }

    async function targetForScan(
      scanId: string,
      payload: unknown,
    ): Promise<string | null> {
      const cached = scanCacheRef.current[scanId];
      if (cached) return cached;
      const fromPayload = extractTargetUrlFromPayload(payload);
      if (fromPayload) return fromPayload;
      const { data } = await supabase
        .from("scans")
        .select("target_url")
        .eq("id", scanId)
        .maybeSingle();
      const target = data?.target_url ?? null;
      if (target) scanCacheRef.current[scanId] = target;
      return target;
    }

    const channel = supabase
      .channel(`tactical-map:events:${sessionIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_logs" },
        async (payload) => {
          if (!mounted) return;
          const row = payload.new as {
            id: number;
            scan_id: string;
            type: string;
            payload: unknown;
          };
          if (userId && !allowedScanIds.has(row.scan_id)) return;
          const kind = String(row.type ?? "").toLowerCase();
          if (kind !== "breach" && kind !== "strike") return;

          const targetUrl = await targetForScan(row.scan_id, row.payload);
          const geo = resolvePulseGeo(targetUrl);
          if (!geo) return;
          const xy = proj([geo.lng, geo.lat]);
          if (!xy) return;

          const id = `scan-${row.id}`;
          setPings((prev) => [...prev.filter((p) => p.id !== id).slice(-8), { x: xy[0], y: xy[1], id }]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [visible, userId]);

  const heightClass = dense ? "h-[360px]" : "h-[220px]";

  return (
    <div
      ref={rootRef}
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
        {LAND_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {pings.map((p) => (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <circle r={4} fill="none" stroke={SCAN_COLOR} strokeWidth={2} opacity={0.9}>
              <animate attributeName="r" values="2;10;2" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r={2} fill={SCAN_COLOR} />
          </g>
        ))}
      </svg>
      {pings.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[9px] uppercase tracking-widest text-white/25">
          No geo-resolved targets — pulses appear on breach/strike with a valid scan target URL
        </div>
      ) : null}
    </div>
  );
}

export function TacticalWorldMap(props: LiveWorldMapProps) {
  if (!LAND_PATHS?.length) {
    return (
      <div
        className={`relative w-full overflow-hidden rounded-xs bg-[#050505] ${props.dense ? "h-[360px]" : "h-[220px]"}`}
        aria-label="Tactical world map loading"
      />
    );
  }
  return <TacticalWorldMapCanvas {...props} />;
}
