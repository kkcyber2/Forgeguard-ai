-- Operation: Kinetic Strike — scan_logs vocabulary + financial liability column
-- Idempotent: safe to re-run on production.

-- ── scan_logs.type → kinetic vocabulary (info, thought, strike, breach, finance) ──
DO $$
DECLARE
  con_name text;
BEGIN
  -- Drop any existing CHECK on scan_logs.type (text column or enum-backed)
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'scan_logs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.scan_logs DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

-- Ensure type is text (handles legacy enum columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scan_logs'
      AND column_name = 'type'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE public.scan_logs
      ALTER COLUMN type TYPE text USING type::text;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.scan_logs
  ADD CONSTRAINT scan_logs_type_kinetic_check
  CHECK (type IN ('info', 'thought', 'strike', 'breach', 'finance'));

-- ── scan_reports.financial_liability_usd (per-scan rollup) ──
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS financial_liability_usd numeric DEFAULT NULL;

COMMENT ON COLUMN public.scan_reports.financial_liability_usd IS
  'Sum of per-breach financial_liability_usd from kinetic judge (single-incident USD).';

-- Backfill from ale_usd when kinetic column empty
UPDATE public.scan_reports
SET financial_liability_usd = ale_usd
WHERE financial_liability_usd IS NULL
  AND ale_usd IS NOT NULL;

-- audit_report_md already added in 0003_audit_enhancements.sql
ALTER TABLE public.scan_reports
  ADD COLUMN IF NOT EXISTS audit_report_md text;
