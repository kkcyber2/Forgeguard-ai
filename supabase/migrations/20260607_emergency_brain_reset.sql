-- Emergency brain reset: kill stuck scans, numeric attacks_run, expanded scan_logs types
-- Idempotent where possible.

BEGIN;

-- 1. Kill all stuck/runaway scans
UPDATE public.scans
SET
  status = 'failed',
  failure_reason = 'EMERGENCY_BRAIN_RESET',
  progress_pct = 100,
  completed_at = COALESCE(completed_at, now())
WHERE status IN ('probing', 'queued');

-- 2. Fix numeric mismatch (22P02) — accept decimals from engine/webhook
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS attacks_run numeric;

ALTER TABLE public.scan_reports
  ALTER COLUMN attacks_run TYPE numeric
  USING (
    CASE
      WHEN attacks_run IS NULL THEN NULL
      WHEN trim(attacks_run::text) = '' THEN NULL
      ELSE attacks_run::numeric
    END
  );

COMMENT ON COLUMN public.scan_reports.attacks_run IS
  'Total attack vectors executed (numeric for engine decimal/string payloads).';

-- 3. Expand scan_logs.type CHECK for webhook + throttle + defense
ALTER TABLE public.scan_logs DROP CONSTRAINT IF EXISTS scan_logs_type_kinetic_check;

ALTER TABLE public.scan_logs
  ADD CONSTRAINT scan_logs_type_kinetic_check
  CHECK (
    type IN (
      'info',
      'thought',
      'strike',
      'breach',
      'finance',
      'defense',
      'webhook',
      'throttle'
    )
  );

COMMIT;
