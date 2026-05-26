/** Map scan target URLs to global PoP node ids (29-node war room grid). */

export const POP_NODE_IDS = [
  "sea", "sfo", "lax", "chi", "iad", "nyc", "yyz", "gru", "bog",
  "lhr", "dub", "ams", "fra", "par", "mad", "mil", "sto", "war",
  "jnb", "nbo", "dxb", "del", "bom", "sin", "hkg", "sha", "sel", "nrt", "syd",
] as const;

export type PopNodeId = (typeof POP_NODE_IDS)[number];

export interface ScanTargetPulse {
  id: string;
  target_url: string;
  target_model?: string | null;
}

const REGION_RULES: Array<{ test: RegExp; node: PopNodeId }> = [
  { test: /\.(uk|co\.uk|ie)$/i, node: "lhr" },
  { test: /\.(de|at|ch)$/i, node: "fra" },
  { test: /\.(fr|be)$/i, node: "par" },
  { test: /\.(nl)$/i, node: "ams" },
  { test: /\.(es|pt)$/i, node: "mad" },
  { test: /\.(it)$/i, node: "mil" },
  { test: /\.(se|no|fi|dk)$/i, node: "sto" },
  { test: /\.(pl|cz|hu)$/i, node: "war" },
  { test: /\.(jp|co\.jp)$/i, node: "nrt" },
  { test: /\.(kr|co\.kr)$/i, node: "sel" },
  { test: /\.(cn|com\.cn)$/i, node: "sha" },
  { test: /\.(hk)$/i, node: "hkg" },
  { test: /\.(sg)$/i, node: "sin" },
  { test: /\.(in|co\.in)$/i, node: "bom" },
  { test: /\.(au|com\.au|nz)$/i, node: "syd" },
  { test: /\.(za|co\.za)$/i, node: "jnb" },
  { test: /\.(ke|co\.ke)$/i, node: "nbo" },
  { test: /\.(ae|sa)$/i, node: "dxb" },
  { test: /\.(br|com\.br)$/i, node: "gru" },
  { test: /\.(co|mx|cl)$/i, node: "bog" },
  { test: /eu-|\.eu\.|europe/i, node: "ams" },
  { test: /us-east|virginia|ashburn|iad/i, node: "iad" },
  { test: /us-west|oregon|california|openai|anthropic|groq/i, node: "sfo" },
  { test: /azure|microsoft/i, node: "chi" },
  { test: /google|gcp/i, node: "iad" },
];

function hashHost(host: string): number {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return h;
}

export function resolveScanNode(
  targetUrl: string,
  fallbackIndex: number,
): PopNodeId {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    for (const rule of REGION_RULES) {
      if (rule.test.test(host)) return rule.node;
    }
    return POP_NODE_IDS[hashHost(host) % POP_NODE_IDS.length]!;
  } catch {
    return POP_NODE_IDS[fallbackIndex % POP_NODE_IDS.length]!;
  }
}

export function resolveScanTargets(
  scans: ScanTargetPulse[],
): PopNodeId[] {
  return scans.slice(0, 5).map((s, i) => resolveScanNode(s.target_url, i));
}

/** WGS84 centroids for PoP nodes (Mercator projection input). */
export const POP_GEO_COORDS: Record<PopNodeId, { lat: number; lng: number }> = {
  sea: { lat: 47.6, lng: -122.3 },
  sfo: { lat: 37.8, lng: -122.4 },
  lax: { lat: 34.0, lng: -118.2 },
  chi: { lat: 41.9, lng: -87.6 },
  iad: { lat: 39.0, lng: -77.5 },
  nyc: { lat: 40.7, lng: -74.0 },
  yyz: { lat: 43.7, lng: -79.4 },
  gru: { lat: -23.5, lng: -46.6 },
  bog: { lat: 4.7, lng: -74.1 },
  lhr: { lat: 51.5, lng: -0.1 },
  dub: { lat: 53.3, lng: -6.3 },
  ams: { lat: 52.4, lng: 4.9 },
  fra: { lat: 50.1, lng: 8.7 },
  par: { lat: 48.9, lng: 2.3 },
  mad: { lat: 40.4, lng: -3.7 },
  mil: { lat: 45.5, lng: 9.2 },
  sto: { lat: 59.3, lng: 18.1 },
  war: { lat: 52.2, lng: 21.0 },
  jnb: { lat: -26.2, lng: 28.0 },
  nbo: { lat: -1.3, lng: 36.8 },
  dxb: { lat: 25.2, lng: 55.3 },
  del: { lat: 28.6, lng: 77.2 },
  bom: { lat: 19.1, lng: 72.9 },
  sin: { lat: 1.3, lng: 103.8 },
  hkg: { lat: 22.3, lng: 114.2 },
  sha: { lat: 31.2, lng: 121.5 },
  sel: { lat: 37.6, lng: 127.0 },
  nrt: { lat: 35.8, lng: 140.4 },
  syd: { lat: -33.9, lng: 151.2 },
};

export function nodeToGeo(nodeId: PopNodeId): { lat: number; lng: number } {
  return POP_GEO_COORDS[nodeId] ?? { lat: 0, lng: 0 };
}

export function resolveScanGeo(
  targetUrl: string,
  fallbackIndex: number,
): { lat: number; lng: number } {
  return nodeToGeo(resolveScanNode(targetUrl, fallbackIndex));
}
