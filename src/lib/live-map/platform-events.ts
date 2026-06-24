import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  extractTargetUrlFromPayload,
  geoFromIpHash,
  resolvePulseGeo,
} from "@/lib/live-map/geo";
import { getExternalIntelStrip, type ExternalIntelItem } from "@/lib/live-map/external-intel";

export type PlatformEventSource = "scan" | "perimeter";

export interface PlatformEvent {
  id: string;
  source: PlatformEventSource;
  kind: string;
  severity: string;
  label: string;
  detail?: string | null;
  targetUrl?: string | null;
  path?: string | null;
  createdAt: string;
  geo: { lat: number; lng: number } | null;
}

export interface LiveMapBootstrap {
  events: PlatformEvent[];
  scanTargetById: Record<string, string>;
  externalIntel: ExternalIntelItem[];
}

function mapScanLogRow(
  row: {
    id: number;
    scan_id: string;
    type: string;
    severity: string;
    attack_name: string | null;
    payload: unknown;
    created_at: string;
  },
  targetUrl: string | null,
): PlatformEvent {
  const geo = resolvePulseGeo(targetUrl);
  return {
    id: `scan-${row.id}`,
    source: "scan",
    kind: row.type,
    severity: row.severity,
    label: row.attack_name ?? row.type,
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
  };
}

function mapPerimeterRow(row: {
  id: string;
  ip_hash: string;
  path: string | null;
  severity: string;
  geo_lat: number;
  geo_lng: number;
  reason: string | null;
  created_at: string;
}): PlatformEvent {
  const geo =
    Number.isFinite(row.geo_lat) && Number.isFinite(row.geo_lng)
      ? { lat: row.geo_lat, lng: row.geo_lng }
      : geoFromIpHash(row.ip_hash);

  return {
    id: `perimeter-${row.id}`,
    source: "perimeter",
    kind: "block",
    severity: row.severity,
    label: row.reason ?? "fortress_block",
    path: row.path,
    createdAt: row.created_at,
    geo,
  };
}

export async function fetchLiveMapBootstrap(limit = 20): Promise<LiveMapBootstrap> {
  const [externalIntel, scanBundle, perimeterRows] = await Promise.all([
    getExternalIntelStrip(),
    fetchRecentScanEvents(limit),
    fetchRecentPerimeterEvents(limit),
  ]);

  const merged = [...scanBundle.events, ...perimeterRows]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);

  return {
    events: merged,
    scanTargetById: scanBundle.scanTargetById,
    externalIntel,
  };
}

async function fetchRecentScanEvents(limit: number): Promise<{
  events: PlatformEvent[];
  scanTargetById: Record<string, string>;
}> {
  try {
    const admin = createAdminSupabase();
    const { data: logs } = await admin
      .from("scan_logs")
      .select("id, scan_id, type, severity, attack_name, payload, created_at")
      .in("type", ["breach", "strike"])
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    const scanIds = [
      ...new Set((logs ?? []).map((l) => l.scan_id).filter(Boolean)),
    ];
    const { data: scans } = scanIds.length
      ? await admin.from("scans").select("id, target_url").in("id", scanIds)
      : { data: [] };

    const scanTargetById: Record<string, string> = {};
    for (const s of scans ?? []) {
      if (s.target_url) scanTargetById[s.id] = s.target_url;
    }

    const events = (logs ?? []).map((row) => {
      const fromScan = scanTargetById[row.scan_id] ?? null;
      const fromPayload = extractTargetUrlFromPayload(row.payload);
      const targetUrl = fromScan ?? fromPayload;
      return mapScanLogRow(row, targetUrl);
    });

    return { events, scanTargetById };
  } catch (err) {
    console.error("[live-map] scan events:", err);
    return { events: [], scanTargetById: {} };
  }
}

async function fetchRecentPerimeterEvents(
  limit: number,
): Promise<PlatformEvent[]> {
  try {
    const admin = createAdminSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("perimeter_events")
      .select(
        "id, ip_hash, path, severity, geo_lat, geo_lng, reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((data ?? []) as Array<{
      id: string;
      ip_hash: string;
      path: string | null;
      severity: string;
      geo_lat: number;
      geo_lng: number;
      reason: string | null;
      created_at: string;
    }>).map(mapPerimeterRow);
  } catch (err) {
    console.error("[live-map] perimeter events:", err);
    return [];
  }
}
