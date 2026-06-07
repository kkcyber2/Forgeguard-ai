-- Persist raw target HTTP diagnostics when strikes are rejected (404 / model mismatch).

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS target_diagnostic_logs text;

COMMENT ON COLUMN public.scans.target_diagnostic_logs IS
  'Raw target HTTP response body when strikes fail (404 model not found, etc.).';
