import { geoFromIpHash, hashIpAddress } from "@/lib/live-map/geo";

export type PerimeterSeverity = "low" | "medium" | "high" | "critical";

export interface PerimeterEventInput {
  ip: string;
  path?: string | null;
  severity?: PerimeterSeverity;
  reason: string;
  source?: string;
  geoLat?: number;
  geoLng?: number;
  geoCountry?: string | null;
  threatDelta?: number;
}

function severityFromReason(reason: string): PerimeterSeverity {
  const r = reason.toLowerCase();
  if (
    r.includes("webhook") ||
    r.includes("fortress") ||
    r.includes("sovereign") ||
    r.includes("honeypot")
  ) {
    return "critical";
  }
  if (r.includes("burst") || r.includes("rate_limit")) return "medium";
  return "high";
}

/**
 * Fire-and-forget perimeter event — safe from Edge middleware (REST + service role).
 */
export function logPerimeterEvent(input: PerimeterEventInput): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !input.ip.trim()) return;

  const ipHash = hashIpAddress(input.ip);
  const fallbackGeo = geoFromIpHash(ipHash);
  const severity = input.severity ?? severityFromReason(input.reason);

  void fetch(`${url}/rest/v1/perimeter_events`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ip_hash: ipHash,
      path: input.path ?? null,
      severity,
      geo_lat: input.geoLat ?? fallbackGeo.lat,
      geo_lng: input.geoLng ?? fallbackGeo.lng,
      geo_country: input.geoCountry ?? null,
      threat_delta: input.threatDelta ?? null,
      reason: input.reason,
      source: input.source ?? "fortress",
    }),
  }).catch(() => {
    /* never block request path */
  });
}
