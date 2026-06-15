-- Ghost Protocol — profiles.is_ghost_active + subscription_tier gatekeeping
-- Run via CITADEL_LAUNCH_VAULT/RUN_IN_SUPABASE.sql (consolidated master file)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ghost_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_tier text;

UPDATE public.profiles p
   SET subscription_tier = COALESCE(
     (
       SELECT s.plan FROM public.subscriptions s
        WHERE s.user_id = p.id AND s.status IN ('active', 'trialing', 'past_due')
        ORDER BY s.created_at DESC LIMIT 1
     ),
     NULLIF(p.current_plan, ''),
     'free'
   )
 WHERE p.subscription_tier IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IS NULL OR subscription_tier IN ('free', 'startup', 'enterprise', 'sovereign'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_ghost_active
  ON public.profiles (is_ghost_active) WHERE is_ghost_active = true;
