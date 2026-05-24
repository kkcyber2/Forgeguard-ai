-- ============================================================
-- Parallel Sovereignty — dual dashboard environments
-- ForgeGuard AI — 2026-05-22
-- ============================================================

-- Allow NULL user_type until identity gate completes
ALTER TABLE public.profiles
  ALTER COLUMN user_type DROP NOT NULL,
  ALTER COLUMN user_type DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN access_level SET DEFAULT 0;

-- UI environment toggle (client vs hacker workspace)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_view_mode text
    CHECK (active_view_mode IS NULL OR active_view_mode IN ('client', 'hacker'));

COMMENT ON COLUMN public.profiles.active_view_mode IS
  'Parallel Sovereignty: active dashboard environment (client | hacker)';

CREATE INDEX IF NOT EXISTS idx_profiles_active_view_mode
  ON public.profiles (active_view_mode);

-- Backfill view mode from existing identity
UPDATE public.profiles
   SET active_view_mode = CASE
     WHEN user_type = 'client' THEN 'client'
     WHEN user_type IN ('hacker', 'developer') THEN 'hacker'
     ELSE NULL
   END
 WHERE active_view_mode IS NULL AND user_type IS NOT NULL;
