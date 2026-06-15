#!/usr/bin/env node
/**
 * Apply prepped launch sections via pg (requires SUPABASE_DB_PASSWORD or DATABASE_URL).
 * Logs results to .launch-sections/apply-results.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.launch-sections');
const PROJECT_REF = 'nlginrukltrwpkyujzzx';
const START = Number(process.argv[2] || 6);
const END = Number(process.argv[3] || 49);

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (password) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  }
  return null;
}

function prepRetry(sql, errMsg) {
  let fixed = sql;
  if (/cannot change name of view column/i.test(errMsg)) {
    fixed = fixed.replace(/CREATE OR REPLACE VIEW/gi, 'DROP VIEW IF EXISTS public.my_scan_quota CASCADE;\nCREATE VIEW');
  }
  if (/duplicate_object|already exists/i.test(errMsg)) {
    // already idempotent in prepped files
  }
  if (/column .* does not exist/i.test(errMsg)) {
    const col = errMsg.match(/column "([^"]+)"/i)?.[1];
    if (col === 'created_at') {
      fixed = `ALTER TABLE public.legal_authorizations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();\nUPDATE public.legal_authorizations SET created_at = signed_at WHERE created_at IS NULL AND signed_at IS NOT NULL;\n` + fixed;
    }
  }
  return fixed;
}

async function runSection(client, i) {
  const file = path.join(DIR, `_prepped_${String(i).padStart(2, '0')}.sql`);
  if (!fs.existsSync(file)) return { i, status: 'missing' };
  const sql = fs.readFileSync(file, 'utf8');
  try {
    await client.query(sql);
    return { i, status: 'ok' };
  } catch (e1) {
    const msg1 = e1.message || String(e1);
    try {
      await client.query(prepRetry(sql, msg1));
      return { i, status: 'ok_retry', firstError: msg1 };
    } catch (e2) {
      return { i, status: 'failed', error: e2.message || String(e2), firstError: msg1 };
    }
  }
}

async function main() {
  const cs = resolveDatabaseUrl();
  if (!cs) {
    console.error('Missing DATABASE_URL or SUPABASE_DB_PASSWORD');
    process.exit(2);
  }
  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const results = [];
  for (let i = START; i <= END; i++) {
    process.stderr.write(`section ${i}...`);
    const r = await runSection(client, i);
    results.push(r);
    process.stderr.write(` ${r.status}\n`);
  }
  await client.end();
  const out = path.join(DIR, 'apply-results.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ ok: results.filter(r => r.status.startsWith('ok')).length, failed: results.filter(r => r.status === 'failed').length, out }));
}

main().catch((e) => { console.error(e); process.exit(1); });
