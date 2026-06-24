"use client";

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { PlatformEvent } from "@/lib/live-map/platform-events";
import type { ExternalIntelItem } from "@/lib/live-map/external-intel";
import {
  extractTargetUrlFromPayload,
  geoFromIpHash,
  resolvePulseGeo,
} from "@/lib/live-map/geo";

const MAX_EVENTS = 20;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function severityClass(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "critical") return "text-red-400 border-red-400/30";
  if (s === "high") return "text-amber-300 border-amber-400/30";
  if (s === "medium") return "text-sky-300 border-sky-400/30";
  return "text-white/45 border-white/10";
}

export interface LiveMapFeedPanelProps {
  initialEvents: PlatformEvent[];
  externalIntel: ExternalIntelItem[];
  scanTargetById: Record<string, string>;
  onEventPulse?: (event: PlatformEvent) => void;
  showPerimeter?: boolean;
}

export function LiveMapFeedPanel({
  initialEvents,
  externalIntel,
  scanTargetById,
  onEventPulse,
  showPerimeter = true,
}: LiveMapFeedPanelProps) {
  const [events, setEvents] = React.useState<PlatformEvent[]>(
    initialEvents.slice(0, MAX_EVENTS),
  );
  const scanCacheRef = React.useRef<Record<string, string>>(scanTargetById);

  React.useEffect(() => {
    scanCacheRef.current = { ...scanCacheRef.current, ...scanTargetById };
  }, [scanTargetById]);

  const pushEvent = React.useCallback(
    (event: PlatformEvent) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [event, ...prev].slice(0, MAX_EVENTS);
      });
      if (event.geo) onEventPulse?.(event);
    },
    [onEventPulse],
  );

  React.useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    let mounted = true;
    const supabase = createBrowserClient(url, key);
    const sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `feed-${Date.now()}`;

    async function resolveTargetUrl(
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
      .channel(`live-map-feed:${sessionId}`)
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

          const targetUrl = await resolveTargetUrl(row.scan_id, row.payload);
          const geo = resolvePulseGeo(targetUrl);
          if (!geo) return;

          pushEvent({
            id: `scan-${row.id}`,
            source: "scan",
            kind,
            severity: row.severity,
            label: row.attack_name ?? kind,
            detail: targetUrl
              ? (() => {
                  try {
                    return new URL(targetUrl).hostname;
                  } catch {
                    return targetUrl.slice(0, 48);
                  }
                })()
              : null,
            targetUrl,
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

          pushEvent({
            id: `perimeter-${row.id}`,
            source: "perimeter",
            kind: "block",
            severity: row.severity,
            label: row.reason ?? "fortress_block",
            path: row.path,
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
  }, [pushEvent, showPerimeter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#D1FF00]/80">
          Live feed
        </p>
        <p className="mt-0.5 font-mono text-[8px] text-white/35">
          Platform telemetry · scan breach/strike + fortress blocks
        </p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-white/[0.04]">
        {events.length === 0 ? (
          <li className="px-3 py-6 text-center font-mono text-[10px] text-white/35">
            No pulses yet — waiting for scan or perimeter events.
          </li>
        ) : (
          events.map((e) => (
            <li key={e.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-white/85">
                    {e.label}
                  </p>
                  <p className="truncate font-mono text-[9px] text-white/40">
                    {e.source === "perimeter"
                      ? e.path ?? "perimeter"
                      : e.detail ?? e.kind}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[8px] uppercase ${severityClass(e.severity)}`}
                >
                  {e.severity}
                </span>
              </div>
              <time className="mt-1 block font-mono text-[8px] text-white/30">
                {formatTime(e.createdAt)}
              </time>
            </li>
          ))
        )}
      </ul>

      <div className="border-t border-white/[0.06] bg-black/40">
        <div className="border-b border-white/[0.04] px-3 py-1.5">
          <p className="font-mono text-[8px] uppercase tracking-widest text-white/30">
            External · not ForgeGuard telemetry
          </p>
        </div>
        <ul className="max-h-[140px] overflow-y-auto px-3 py-2">
          {externalIntel.length === 0 ? (
            <li className="py-2 font-mono text-[9px] text-white/30">
              CISA KEV feed unavailable
            </li>
          ) : (
            externalIntel.slice(0, 6).map((item) => (
              <li key={item.id} className="py-1.5">
                <p className="truncate font-mono text-[9px] text-violet-300/90">
                  {item.id}
                </p>
                <p className="truncate text-[9px] text-white/40">
                  {item.vendor} · {item.product}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
