-- Identity auditor: persist last rejection reason for operator-facing UI
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_failure_reason text;

COMMENT ON COLUMN public.profiles.identity_failure_reason IS
  'Last identity auditor rejection reason (vision/DeepSeek/heuristic)';
