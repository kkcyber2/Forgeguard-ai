/**
 * Operator script: re-dispatch a stuck queued scan via runScan handshake.
 * Usage: node --env-file=.env.local scripts/retry-queued-scan.mjs <scan_id>
 */
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";

const scanId = process.argv[2];
if (!scanId) {
  console.error("Usage: node --env-file=.env.local scripts/retry-queued-scan.mjs <scan_id>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const credSecret = process.env.SCAN_CREDENTIAL_SECRET;
const engineUrl = (process.env.PYTHON_ENGINE_URL ?? process.env.AGATHON_ORCHESTRATOR_URL ?? "").replace(/\/+$/, "");
const token = process.env.INTERNAL_SCAN_TOKEN ?? process.env.AGATHON_INTERNAL_SECRET;

if (!supabaseUrl || !serviceKey || !credSecret || !engineUrl || !token) {
  console.error("Missing required env vars");
  process.exit(1);
}

function openCredential(sealed) {
  const [ivB64, tagB64, ctB64] = sealed.split(":");
  const key = Buffer.from(credSecret, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
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
