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
