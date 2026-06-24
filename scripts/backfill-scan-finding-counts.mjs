#!/usr/bin/env node
/**
 * Backfill scans.finding_count / high_severity_count from scan_reports or scan_logs.
 * Optionally insert minimal scan_reports for sealed scans with breach logs but no report.
 *
 * Usage:
 *   node scripts/backfill-scan-finding-counts.mjs
 *   node scripts/backfill-scan-finding-counts.mjs --dry-run
 *   node scripts/backfill-scan-finding-counts.mjs --rebuild-reports
 *
 * Requires DATABASE_URL or SUPABASE_DB_PASSWORD (see run-launch-all.mjs).
 */

import pg from "pg";

const PROJECT_REF = "nlginrukltrwpkyujzzx";
const dryRun = process.argv.includes("--dry-run");
const rebuildReports = process.argv.includes("--rebuild-reports");

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (password) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  }
  return null;
}

const SYNC_FROM_REPORTS = `
UPDATE scans s SET
  finding_count = sub.fc,
  high_severity_count = sub.hc
FROM (
  SELECT sr.scan_id,
    COUNT(*) FILTER (
      WHERE COALESCE(f->>'severity','') IN ('high','critical') OR (f->>'success')::boolean IS TRUE
    ) AS fc,
    COUNT(*) FILTER (
      WHERE COALESCE(f->>'severity','') IN ('high','critical')
    ) AS hc
  FROM scan_reports sr,
    LATERAL jsonb_array_elements(COALESCE(sr.findings, '[]'::jsonb)) AS f
  GROUP BY sr.scan_id
) sub
WHERE s.id = sub.scan_id
  AND s.status = 'sealed'
  AND COALESCE(s.finding_count, 0) = 0
  AND sub.fc > 0;
`;

const SYNC_FROM_LOGS = `
UPDATE scans s SET
  finding_count = sub.fc,
  high_severity_count = sub.hc
FROM (
  SELECT scan_id,
    COUNT(*) FILTER (WHERE type = 'breach') AS fc,
    COUNT(*) FILTER (
      WHERE type = 'breach' AND severity IN ('high','critical')
    ) AS hc
  FROM scan_logs
  GROUP BY scan_id
) sub
WHERE s.id = sub.scan_id
  AND s.status = 'sealed'
  AND COALESCE(s.finding_count, 0) = 0
  AND sub.fc > 0;
`;

const INSERT_MINIMAL_REPORTS = `
INSERT INTO scan_reports (
  scan_id, generator_model, executive_summary_md, cvss_overall, risk_label,
  findings, attack_path
)
SELECT s.id,
  'backfill-script',
  'Backfilled from breach logs — operator review recommended.',
  0,
  'NONE',
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'attack', l.attack_name,
        'severity', COALESCE(l.severity, 'high'),
        'success', true,
        'evidence', l.payload
      ))
      FROM scan_logs l
      WHERE l.scan_id = s.id AND l.type = 'breach'
    ),
    '[]'::jsonb
  ),
  '[]'::jsonb
FROM scans s
LEFT JOIN scan_reports sr ON sr.scan_id = s.id
WHERE s.status = 'sealed'
  AND sr.scan_id IS NULL
  AND EXISTS (
    SELECT 1 FROM scan_logs l
    WHERE l.scan_id = s.id AND l.type = 'breach'
  );
`;

async function main() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error("[backfill] Set DATABASE_URL or SUPABASE_DB_PASSWORD");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  if (dryRun) {
    const { rows } = await client.query(`
      SELECT s.id, s.finding_count,
        (SELECT COUNT(*) FROM scan_logs l WHERE l.scan_id = s.id AND l.type = 'breach') AS breaches,
        sr.scan_id IS NOT NULL AS has_report
      FROM scans s
      LEFT JOIN scan_reports sr ON sr.scan_id = s.id
      WHERE s.status = 'sealed' AND COALESCE(s.finding_count, 0) = 0;
    `);
    console.log("[backfill] dry-run candidates:", rows);
    await client.end();
    return;
  }

  const r1 = await client.query(SYNC_FROM_REPORTS);
  console.log("[backfill] sync from reports:", r1.rowCount, "rows");

  const r2 = await client.query(SYNC_FROM_LOGS);
  console.log("[backfill] sync from logs:", r2.rowCount, "rows");

  if (rebuildReports) {
    const r3 = await client.query(INSERT_MINIMAL_REPORTS);
    console.log("[backfill] minimal reports inserted:", r3.rowCount, "rows");
  }

  const { rows: summary } = await client.query(`
    SELECT id, status, finding_count, high_severity_count FROM scans
    WHERE status = 'sealed' ORDER BY created_at DESC;
  `);
  console.log("[backfill] sealed scans after:", summary);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
