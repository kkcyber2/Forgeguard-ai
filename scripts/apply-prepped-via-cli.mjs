#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.launch-sections');
const START = Number(process.argv[2] || 6);
const END = Number(process.argv[3] || 49);

function prepRetry(sql, err) {
  let fixed = sql;
  const msg = String(err);
  if (/cannot change name of view column/i.test(msg)) {
    fixed = fixed.replace(
      /CREATE OR REPLACE VIEW (public\.)?(\w+)/gi,
      'DROP VIEW IF EXISTS $1$2 CASCADE;\nCREATE VIEW $1$2'
    );
  }
  if (/column "created_at" does not exist/i.test(msg)) {
    fixed =
      `ALTER TABLE public.legal_authorizations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();\nUPDATE public.legal_authorizations SET created_at = signed_at WHERE created_at IS NULL AND signed_at IS NOT NULL;\n` +
      fixed;
  }
  if (/column "user_id" does not exist/i.test(msg) && /agent_memories/i.test(msg)) {
    fixed =
      `ALTER TABLE public.agent_memories ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;\nUPDATE public.agent_memories am SET user_id = s.user_id FROM public.scans s WHERE am.scan_id = s.id AND am.user_id IS NULL;\n` +
      fixed;
  }
  if (/column "target_domain" does not exist/i.test(msg)) {
    fixed =
      `ALTER TABLE public.target_verifications ADD COLUMN IF NOT EXISTS target_domain text, ADD COLUMN IF NOT EXISTS method text, ADD COLUMN IF NOT EXISTS token text, ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');\nUPDATE public.target_verifications SET target_domain = target_url WHERE target_domain IS NULL AND target_url IS NOT NULL;\nUPDATE public.target_verifications SET token = verification_token WHERE token IS NULL AND verification_token IS NOT NULL;\nUPDATE public.target_verifications SET verified = is_verified WHERE verified IS NULL;\n` +
      fixed;
  }
  return fixed;
}

const TMP = process.env.FG_LAUNCH_DIR || 'C:/fg-launch';

function runQuery(filePath) {
  const fp = filePath.replace(/\\/g, '/');
  return spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '-f', fp],
    { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 50 * 1024 * 1024 }
  );
}

const results = [];
for (let i = START; i <= END; i++) {
  const src = path.join(TMP, `_prepped_${String(i).padStart(2, '0')}.sql`);
  if (!fs.existsSync(src)) {
    results.push({ i, status: 'missing' });
    continue;
  }
  const tmp = path.join(TMP, `_run_${i}.sql`);
  fs.copyFileSync(src, tmp);
  let r = runQuery(tmp);
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim();
    const retrySql = prepRetry(fs.readFileSync(src, 'utf8'), err);
    fs.writeFileSync(tmp, retrySql);
    r = runQuery(tmp);
    if (r.status !== 0) {
      results.push({ i, status: 'failed', error: (r.stderr || r.stdout || '').trim(), firstError: err });
      continue;
    }
    results.push({ i, status: 'ok_retry', firstError: err });
    continue;
  }
  results.push({ i, status: 'ok' });
  process.stderr.write(`${i} ok\n`);
}

const out = path.join(DIR, 'apply-results.json');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.status === 'ok' || r.status === 'ok_retry').length;
const failed = results.filter((r) => r.status === 'failed').length;
console.log(JSON.stringify({ ok, failed, out }));
