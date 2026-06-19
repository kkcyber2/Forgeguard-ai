/**
 * Operator script: re-dispatch a stuck queued scan via runScan handshake.
 * Usage: node --env-file=.env.local scripts/retry-queued-scan.mjs <scan_id>
 */
import { createClient } from "@supabase/supabase-js";

const scanId = process.argv[2];
if (!scanId) {
  console.error("Usage: node --env-file=.env.local scripts/retry-queued-scan.mjs <scan_id>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey || !token) {
  console.error("Missing required env vars (SUPABASE + INTERNAL_SCAN_TOKEN)");
  process.exit(1);
}
const engineUrl = (
  process.env.PYTHON_ENGINE_URL ??
  process.env.AGATHON_ORCHESTRATOR_URL ??
  "https://engine.forgeguard-ai.com"
).replace(/\/+$/, "");
const token = process.env.INTERNAL_SCAN_TOKEN ?? process.env.AGATHON_INTERNAL_SECRET;

function openCredential(blob) {
  let cleaned = blob;
  if (cleaned.startsWith("\\x")) {
    cleaned = Buffer.from(cleaned.slice(2), "hex").toString("utf8");
  }
  const MARKER = "fg1:";
  if (cleaned.startsWith(MARKER)) {
    return Buffer.from(cleaned.slice(MARKER.length), "base64").toString("utf8");
  }
  throw new Error("Unrecognised credential format");
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const { data: scan, error } = await admin
  .from("scans")
  .select("id, user_id, target_model, target_url, target_credential_encrypted, intensity, surface_kind, asset_value_usd, status")
  .eq("id", scanId)
  .maybeSingle();

if (error || !scan) {
  console.error("Scan not found:", error?.message);
  process.exit(1);
}

console.log("Scan:", scan.id, "status:", scan.status, "intensity:", scan.intensity);

const apiKey = openCredential(scan.target_credential_encrypted);
const body = {
  scan_id: scan.id,
  user_id: scan.user_id,
  target_model: scan.target_model,
  target_url: scan.target_url,
  target_api_key: apiKey,
  api_key: apiKey,
  intensity: scan.intensity ?? "standard",
  surface_kind: scan.surface_kind ?? "llm",
  target_type: scan.surface_kind ?? "llm",
  asset_value_usd: scan.asset_value_usd ?? 50000,
  ownership_verified: false,
  is_ghost_active: false,
};

await admin.from("scans").update({ status: "probing", progress_pct: 3, started_at: new Date().toISOString() }).eq("id", scanId);

const resp = await fetch(`${engineUrl}/scan/start`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-internal-scan-token": token,
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(90_000),
});

const text = await resp.text();
console.log("Engine response:", resp.status, text.slice(0, 400));

if (!resp.ok) process.exit(1);

await admin.from("scan_logs").insert({
  scan_id: scanId,
  type: "info",
  severity: "info",
  payload: { message: "Manual retry dispatch accepted", http_status: resp.status },
});

console.log("OK — check scan status in Supabase within 30s");
