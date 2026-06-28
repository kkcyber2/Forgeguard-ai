/**
 * Launch proof helper — verify audit chains for sealed scans (service role).
 * Usage: node scripts/launch-proof-audit.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env or .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function computeEventHash(prevHash, event, scanId, createdAt) {
  const payload = `${prevHash ?? ""}|${event}|${scanId}|${createdAt}`;
  return createHash("sha256").update(payload).digest("hex");
}

async function verifyAuditChain(admin, scanId) {
  const { data, error } = await admin
    .from("scan_audit_events")
    .select("id, event, event_hash, prev_hash, created_at")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  let prevHash = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if ((row.prev_hash ?? null) !== (prevHash ?? null)) {
      return { valid: false, brokenAt: i + 1, length: rows.length };
    }
    const expected = computeEventHash(prevHash, row.event, scanId, row.created_at);
    if (expected !== row.event_hash) {
      return { valid: false, brokenAt: i + 1, length: rows.length };
    }
    prevHash = row.event_hash;
  }
  return { valid: true, brokenAt: null, length: rows.length };
}

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: scans, error: scansErr } = await admin
  .from("scans")
  .select("id, status, intensity, finding_count")
  .eq("status", "sealed")
  .order("created_at", { ascending: false })
  .limit(5);

if (scansErr) {
  console.error("scans query failed:", scansErr.message);
  process.exit(1);
}

console.log("=== Audit chain verification (sealed scans) ===");
for (const s of scans ?? []) {
  const v = await verifyAuditChain(admin, s.id);
  console.log(`${s.id.slice(0, 8)}… intensity=${s.intensity} findings=${s.finding_count} chain=${v.valid ? "VALID" : "BROKEN"} events=${v.length}`);
}

const greasy = scans?.find((s) => s.intensity === "greasy") ?? scans?.[0];
if (greasy) {
  const { data: rules } = await admin
    .from("aegis_rules")
    .select("rule_name, verified_blocks_attack")
    .eq("scan_id", greasy.id);
  const proven = (rules ?? []).filter((r) => r.verified_blocks_attack).length;
  console.log(`\n=== Aegis closed-loop (${greasy.id.slice(0, 8)}…) ===`);
  console.log(`Rules: ${(rules ?? []).length}, proven: ${proven}`);
}

const { count: trainingCount } = await admin
  .from("training_corpus_events")
  .select("*", { count: "exact", head: true });
console.log(`\n=== Training corpus events: ${trainingCount ?? 0} ===`);
