import type { NextRequest } from "next/server";
import { geoFromRequest } from "@/lib/perimeter/geo-from-request";
import {
  incrementThreatScore,
  ipHashFromRequest,
  maybeAutoBlock,
  persistIpBlock,
} from "@/lib/perimeter/ip-blocklist";
import {
  logPerimeterEvent,
  type PerimeterSeverity,
} from "@/lib/perimeter/log-perimeter-event";
import {
  AUTO_BLOCK_SCORE,
  threatDeltaForReason,
} from "@/lib/perimeter/threat-score";
import { getClientIp } from "@/services/scraper-defense.service";

export interface RecordViolationOptions {
  reason: string;
  severity?: PerimeterSeverity;
  source?: string;
  threatDelta?: number;
  forceBlock?: boolean;
}

/**
 * Unified perimeter violation recorder — blacklisted_entities + perimeter_events + threat score.
 */
export function recordPerimeterViolation(
  request: NextRequest,
  options: RecordViolationOptions,
): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = getClientIp(request);
  const ipHash = ipHashFromRequest(request);
  const geo = geoFromRequest(request, ip);
  const delta = options.threatDelta ?? threatDeltaForReason(options.reason);

  logPerimeterEvent({
    ip,
    path: request.nextUrl.pathname,
    reason: options.reason,
    severity: options.severity,
    source: options.source ?? "fortress",
    geoLat: geo.lat,
    geoLng: geo.lng,
    geoCountry: geo.country,
    threatDelta: delta,
  });

  if (url && key) {
    void fetch(`${url}/rest/v1/blacklisted_entities`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ip_address: ip,
        user_agent: request.headers.get("user-agent"),
        reason: options.reason,
        metadata: {
          path: request.nextUrl.pathname,
          method: request.method,
          ip_hash: ipHash,
          geo_country: geo.country,
          threat_delta: delta,
        },
      }),
    }).catch(() => {
      /* never block the edge */
    });
  }

  void (async () => {
    const score = await incrementThreatScore(ipHash, delta);
    if (options.forceBlock) {
      persistIpBlock({
        ipHash,
        reason: `forced:${options.reason}`,
        threatScore: Math.max(score, AUTO_BLOCK_SCORE),
        geoCountry: geo.country,
      });
      return;
    }
    if (score >= AUTO_BLOCK_SCORE) {
      await maybeAutoBlock(ipHash, options.reason, score, geo.country);
    }
  })();
}
