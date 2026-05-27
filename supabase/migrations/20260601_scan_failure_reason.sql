-- Operation: Key Isolation — persist auth failures on scans row
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS failure_reason text;

COMMENT ON COLUMN public.scans.failure_reason IS
  'Human-readable failure cause when status=failed (e.g. target API 401).';
