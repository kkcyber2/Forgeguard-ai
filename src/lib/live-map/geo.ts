import {
  nodeToGeo,
  POP_NODE_IDS,
  resolveScanGeo,
  type PopNodeId,
} from "@/lib/admin/resolve-scan-node";

export function hashIpAddress(ip: string): string {
  const normalized = ip.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `ip-${h.toString(16).padStart(8, "0")}`;
}

export function geoFromIpHash(ipHash: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < ipHash.length; i++) {
    h = (h * 31 + ipHash.charCodeAt(i)) >>> 0;
  }
  const nodeId = POP_NODE_IDS[h % POP_NODE_IDS.length] as PopNodeId;
  return nodeToGeo(nodeId);
}

export function extractTargetUrlFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const candidates = [
    row.target_url,
    row.targetUrl,
    row.target,
    row.url,
    row.host,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const v = c.trim();
      if (v.startsWith("http://") || v.startsWith("https://")) return v;
      return `https://${v}`;
    }
  }
  return null;
}

export function resolvePulseGeo(
  targetUrl: string | null | undefined,
  fallbackIndex = 0,
): { lat: number; lng: number } | null {
  if (!targetUrl?.trim()) return null;
  try {
    return resolveScanGeo(targetUrl.trim(), fallbackIndex);
  } catch {
    return null;
  }
}
