#!/usr/bin/env node
/**
 * Run CITADEL_LAUNCH_VAULT/LAUNCH_ALL.sql against live Supabase Postgres.
 *
 * Requires one of:
 *   DATABASE_URL=postgresql://postgres:...@db.nlginrukltrwpkyujzzx.supabase.co:5432/postgres
 *   SUPABASE_DB_PASSWORD=<database password from Dashboard → Settings → Database>
 *
 * Usage:
 *   node scripts/run-launch-all.mjs
 *   node scripts/run-launch-all.mjs --verify-only
 *   node scripts/run-launch-all.mjs --stamp-only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "nlginrukltrwpkyujzzx";
const SQL_FILE = path.join(ROOT, "CITADEL_LAUNCH_VAULT", "LAUNCH_ALL.sql");
const STAMP_FILE = path.join(ROOT, "CITADEL_LAUNCH_VAULT", "LAUNCH_MIGRATION_STAMP.sql");

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify-only");
const stampOnly = args.has("--stamp-only");

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (password) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  }
  return null;
}

const VERIFY_SQL = `
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'crypto_deposits'
   AND column_name IN ('payment_id','plan_id','amount_usdt','deposit_address','credits_granted','confirmed_at','deposit_type')
 ORDER BY column_name;
`;

async function main() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error(
      "[launch-all] Missing DATABASE_URL or SUPABASE_DB_PASSWORD.\n" +
        "  Dashboard → Project Settings → Database → Database password",
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.info("[launch-all] Connected to Supabase Postgres");

  try {
    if (!verifyOnly && !stampOnly) {
      if (!fs.existsSync(SQL_FILE)) {
        throw new Error(`Missing ${SQL_FILE}`);
      }
      const sql = fs.readFileSync(SQL_FILE, "utf8");
      console.info("[launch-all] Executing LAUNCH_ALL.sql (%d KB)...", Math.round(sql.length / 1024));
      await client.query(sql);
      console.info("[launch-all] LAUNCH_ALL.sql completed");
    }

    if (!verifyOnly && fs.existsSync(STAMP_FILE)) {
      const stamp = fs.readFileSync(STAMP_FILE, "utf8");
      console.info("[launch-all] Stamping supabase_migrations.schema_migrations...");
      await client.query(stamp);
      console.info("[launch-all] Migration stamp applied");
    }

    console.info("[launch-all] Verification:");
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crypto_deposits'
         AND column_name IN ('payment_id','plan_id','amount_usdt','deposit_address','credits_granted','confirmed_at','deposit_type')
       ORDER BY column_name`);
    console.info("crypto_deposits columns:", cols.rows.map((r) => r.column_name).join(", ") || "(none)");

    const triggers = await client.query(`
      SELECT tgname FROM pg_trigger t
       JOIN pg_class c ON t.tgrelid = c.oid
       WHERE c.relname = 'crypto_deposits' AND NOT t.tgisinternal`);
    console.info("crypto_deposits triggers:", triggers.rows.map((r) => r.tgname).join(", ") || "(none)");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[launch-all] FAILED:", message);
    if (err && typeof err === "object" && "position" in err) {
      console.error("[launch-all] Error position:", err.position);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
