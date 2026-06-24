"use client";

import * as React from "react";
import { geoMercator } from "d3-geo";
import { createBrowserClient } from "@supabase/ssr";
import worldMapData from "@/lib/geo/world-map-paths.json";
import { LiveMapFeedPanel } from "@/components/dashboard/live-map-feed-panel";
import type { LiveMapBootstrap, PlatformEvent } from "@/lib/live-map/platform-events";
import {
  extractTargetUrlFromPayload,
  geoFromIpHash,
  resolvePulseGeo,
} from "@/lib/live-map/geo";
import type { ScanTargetPulse } from "@/components/dashboard/tactical-world-map";

const WIDTH = worldMapData.width;
const HEIGHT = worldMapData.height;
const LAND_PATHS = worldMapData.paths as string[];
const PROJ_META = worldMapData.projection as {
  translate: [number, number];
  scale: number;
  center: [number, number];
};
const SCAN_COLOR = "#ADFF2F";
const FORTRESS_COLOR = "#A020F0";

function buildProjection() {
  return geoMercator()
    .translate(PROJ_META.translate)
    .scale(PROJ_META.scale)
    .center(PROJ_META.center);
}

type Ping = {
  x: number;
  y: number;
  kind: "scan" | "fortress";
  id: string;
  expiresAt: number;
};

export interface LiveCommandMapProps {
  bootstrap: LiveMapBootstrap;
  scanTargets?: ScanTargetPulse[];
  dense?: boolean;
  showPerimeter?: boolean;
}

export function LiveCommandMap({
  bootstrap,
  scanTargets = [],
  dense = false,
  showPerimeter = true,
}: LiveCommandMapProps) {
  const [pings, setPings] = React.useState<Ping[]>([]);
  const [visible, setVisible] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scanCacheRef = React.useRef(bootstrap.scanTargetById);
  const sessionIdRef = React.useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `map-${Date.now()}`,
  );

  React.useEffect(() => {
    scanCacheRef.current = {
      ...scanCacheRef.current,
      ...bootstrap.scanTargetById,
    };
  }, [bootstrap.scanTargetById]);

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

  const addPing = React.useCallback((event: PlatformEvent) => {
    if (!event.geo) return;
    const proj = buildProjection();
    const xy = proj([event.geo.lng, event.geo.lat]);
    if (!xy) return;
    const id = `ping-${event.id}-${Date.now()}`;
    const kind = event.source === "perimeter" ? "fortress" : "scan";
    const expiresAt = Date.now() + (kind === "fortress" ? 2600 : 4000);
    setPings((prev) => [
      ...prev.filter((p) => p.expiresAt > Date.now()).slice(-10),
      { x: xy[0], y: xy[1], kind, id, expiresAt },
    ]);
    window.setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== id));
    }, kind === "fortress" ? 2600 : 4000);
  }, []);

  React.useEffect(() => {
    const proj = buildProjection();
    const initial: Ping[] = [];
    for (const event of bootstrap.events) {
      if (!event.geo) continue;
      const xy = proj([event.geo.lng, event.geo.lat]);
      if (!xy) continue;
      initial.push({
        x: xy[0],
        y: xy[1],
        kind: event.source === "perimeter" ? "fortress" : "scan",
        id: `boot-${event.id}`,
        expiresAt: Date.now() + 8000,
      });
    }
    setPings(initial.slice(-12));
  }, [bootstrap.events]);

  React.useEffect(() => {
    for (const s of scanTargets) {
      if (s.target_url) scanCacheRef.current[s.id] = s.target_url;
    }
  }, [scanTargets]);

  React.useEffect(() => {
    if (!visible) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    let mounted = true;
    const supabase = createBrowserClient(url, key);

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
      .channel(`live-command-map:${sessionIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_logs" },
        async (payload) => {
          if (!mounted) return;
          const row = payload.new as {
            id: number;
            scan_id: string;
            type: string;
            severity: string;
            attack_name: string | null;
            payload: unknown;
            created_at: string;
          };
          const kind = String(row.type ?? "").toLowerCase();
          if (kind !== "breach" && kind !== "strike") return;

          const targetUrl = await targetForScan(row.scan_id, row.payload);
          const geo = resolvePulseGeo(targetUrl);
          if (!geo) return;

          addPing({
            id: `scan-${row.id}`,
            source: "scan",
            kind,
            severity: row.severity,
            label: row.attack_name ?? kind,
            createdAt: row.created_at,
            geo,
          });
        },
      );

    if (showPerimeter) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "perimeter_events" },
        (payload) => {
          if (!mounted) return;
          const row = payload.new as {
            id: string;
            ip_hash: string;
            path: string | null;
            severity: string;
            geo_lat: number;
            geo_lng: number;
            reason: string | null;
            created_at: string;
          };
          const geo =
            Number.isFinite(row.geo_lat) && Number.isFinite(row.geo_lng)
              ? { lat: row.geo_lat, lng: row.geo_lng }
              : geoFromIpHash(row.ip_hash);

          addPing({
            id: `perimeter-${row.id}`,
            source: "perimeter",
            kind: "block",
            severity: row.severity,
            label: row.reason ?? "block",
            createdAt: row.created_at,
            geo,
          });
        },
      );
    }

    channel.subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [addPing, showPerimeter, visible]);

  const heightClass = dense ? "min-h-[360px] h-[360px]" : "min-h-[220px] h-[220px]";

  return (
    <div
      ref={rootRef}
      className={`grid min-h-0 gap-0 overflow-hidden rounded-xs bg-[#050505] md:grid-cols-[1fr_minmax(200px,260px)] ${heightClass}`}
    >
      <div className="relative min-h-[180px] min-w-0">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Live command map"
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
              <circle
                r={4}
                fill="none"
                stroke={p.kind === "fortress" ? FORTRESS_COLOR : SCAN_COLOR}
                strokeWidth={2}
                opacity={0.9}
              >
                <animate
                  attributeName="r"
                  values={p.kind === "fortress" ? "2;12;2" : "2;10;2"}
                  dur={p.kind === "fortress" ? "1.6s" : "2s"}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0;0.9"
                  dur={p.kind === "fortress" ? "1.6s" : "2s"}
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                r={2}
                fill={p.kind === "fortress" ? FORTRESS_COLOR : SCAN_COLOR}
              />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute bottom-2 right-3 flex flex-wrap justify-end gap-2 font-mono text-[8px] uppercase tracking-widest text-white/35">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ADFF2F]" />
            Scan breach/strike
          </span>
          {showPerimeter && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#A020F0]" />
              Fortress
            </span>
          )}
        </div>
      </div>

      <div className="min-h-[200px] border-t border-white/[0.06] bg-black/30 md:min-h-0 md:border-l md:border-t-0">
        <LiveMapFeedPanel
          initialEvents={bootstrap.events}
          externalIntel={bootstrap.externalIntel}
          scanTargetById={bootstrap.scanTargetById}
          onEventPulse={addPing}
          showPerimeter={showPerimeter}
        />
      </div>
    </div>
  );
}
