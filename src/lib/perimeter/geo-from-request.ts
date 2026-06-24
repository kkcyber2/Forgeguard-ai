import type { NextRequest } from "next/server";
import { geoFromIpHash, hashIpAddress } from "@/lib/live-map/geo";

export interface RequestGeo {
  lat: number;
  lng: number;
  country: string | null;
}

function parseCoord(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Geo from Vercel / Cloudflare edge headers when present; otherwise hash-bucket fallback.
 * No MaxMind license required — uses platform-provided country + coordinates.
 */
export function geoFromRequest(request: NextRequest, ip: string): RequestGeo {
  const country =
    request.headers.get("x-vercel-ip-country")?.trim() ||
    request.headers.get("cf-ipcountry")?.trim() ||
    null;

  const lat =
    parseCoord(request.headers.get("x-vercel-ip-latitude")) ??
    parseCoord(request.headers.get("cf-iplatitude"));
  const lng =
    parseCoord(request.headers.get("x-vercel-ip-longitude")) ??
    parseCoord(request.headers.get("cf-iplongitude"));

  if (lat != null && lng != null) {
    return { lat, lng, country: country && country !== "XX" ? country : null };
  }

  const fallback = geoFromIpHash(hashIpAddress(ip));
  return {
    lat: fallback.lat,
    lng: fallback.lng,
    country: country && country !== "XX" ? country : null,
  };
}
