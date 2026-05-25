-- =============================================================================
-- CITADEL LAUNCH VAULT — Master Schema Updates
-- ForgeGuard Admin Command Center (Sovereign Intelligence OS)
-- Run this in Supabase SQL Editor AFTER reviewing MANUAL_TASKS.md
-- Idempotent: safe to re-run on partially migrated projects
-- =============================================================================

BEGIN;

-- ─── 1. Bazaar: ForgeGuard Certified badge ───────────────────────────────────
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS is_certified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bazaar_scripts.is_certified IS
  'True when admin VERIFY & PUBLISH clears audit — displays ForgeGuard Certified badge';

UPDATE public.bazaar_scripts
   SET is_certified = true
 WHERE is_certified = false
   AND audit_verdict = 'cleared'
   AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_bazaar_scripts_pending_audit
  ON public.bazaar_scripts (audit_verdict, is_published)
  WHERE is_removed = false AND audit_verdict IN ('pending', 'pending_audit', 'flagged');

-- ─── 2. Platform transactions: escrow_hold tx type ───────────────────────────
ALTER TABLE public.platform_transactions
  DROP CONSTRAINT IF EXISTS platform_transactions_tx_type_check;

ALTER TABLE public.platform_transactions
  ADD CONSTRAINT platform_transactions_tx_type_check
  CHECK (tx_type IN (
    'bazaar_purchase',
    'bounty_release',
    'escrow_hold',
    'top_up',
    'refund'
  ));

COMMENT ON COLUMN public.platform_transactions.tx_type IS
  'escrow_hold = client wallet debited on mission assignment';

-- Ensure amount_credits column exists (legacy reconcile)
ALTER TABLE public.platform_transactions
  ADD COLUMN IF NOT EXISTS amount_credits integer DEFAULT 0;

-- ─── 3. Bounty escrow: mission linkage index ─────────────────────────────────
ALTER TABLE public.bounty_escrow
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bounty_escrow_mission
  ON public.bounty_escrow (mission_id)
  WHERE mission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bounty_escrow_held
  ON public.bounty_escrow (status, held_at DESC)
  WHERE status = 'held';

-- ─── 4. Profiles: verification pipeline (Stronghold) ─────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_audit_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS identity_audit_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS identity_audit_notes text,
  ADD COLUMN IF NOT EXISTS sovereign_pending boolean NOT NULL DEFAULT false;

-- Expand clearance_tier to include 'pending'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_clearance_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_clearance_tier_check
  CHECK (clearance_tier IN ('pending', 'tactical', 'professional', 'sovereign'));

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_identity_audit_status_check
    CHECK (identity_audit_status IN ('none','pending','passed','failed','review'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. User wallets: balance_usd + increment_wallet RPC ─────────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS balance_usd numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

UPDATE public.user_wallets
   SET balance_usd = COALESCE(balance_usd, balance::numeric, 0)
 WHERE balance_usd IS NULL;

CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance_usd, balance)
  VALUES (p_user_id, GREATEST(p_amount, 0), GREATEST(p_amount::integer, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = GREATEST(public.user_wallets.balance_usd + p_amount, 0),
        balance     = GREATEST((public.user_wallets.balance_usd + p_amount)::integer, 0),
        updated_at    = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) TO service_role;

-- ─── 6. Realtime: scan_logs for live world map heartbeat ─────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 7. Storage: verification-docs bucket (private, service-role read) ───────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Users upload to their own folder; admins read via service role
DO $$ BEGIN
  CREATE POLICY "verification_docs_owner_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "verification_docs_owner_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 8. Persona switcher — current_persona ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_persona text;

UPDATE public.profiles
   SET current_persona = CASE
     WHEN active_view_mode IN ('client', 'hacker') THEN active_view_mode
     WHEN user_type = 'client' THEN 'client'
     WHEN user_type = 'hacker' THEN 'hacker'
     WHEN user_type = 'developer' THEN COALESCE(active_view_mode, 'hacker')
     ELSE 'hacker'
   END
 WHERE current_persona IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_current_persona_check
    CHECK (current_persona IS NULL OR current_persona IN ('client', 'hacker', 'dev'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN current_persona SET DEFAULT 'hacker';

COMMENT ON COLUMN public.profiles.current_persona IS
  'Active UI persona: client | hacker | dev (Sovereign admin console)';

-- ─── 9. Iron Wall — verification pipeline repair ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_domain      text,
  ADD COLUMN IF NOT EXISTS company_tag         text,
  ADD COLUMN IF NOT EXISTS domain_token        text,
  ADD COLUMN IF NOT EXISTS domain_verify_token text,
  ADD COLUMN IF NOT EXISTS domain_verified     boolean NOT NULL DEFAULT false;

UPDATE public.profiles
   SET domain_token = COALESCE(domain_token, domain_verify_token)
 WHERE domain_token IS NULL AND domain_verify_token IS NOT NULL;

UPDATE public.profiles
   SET domain_verify_token = COALESCE(domain_verify_token, domain_token)
 WHERE domain_verify_token IS NULL AND domain_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.otp_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone         text NOT NULL,
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'failed', 'verified', 'expired')),
  provider      text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_logs_user
  ON public.otp_logs (user_id, created_at DESC);

ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "otp_logs: owner read"
    ON public.otp_logs FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "otp_logs: service all"
    ON public.otp_logs FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 10. Ghost Protocol — elite hacker stealth identity ──────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ghost_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_tier text;

COMMENT ON COLUMN public.profiles.is_ghost_active IS
  'When true, operator identity is masked platform-wide (Ghost Protocol)';

COMMENT ON COLUMN public.profiles.subscription_tier IS
  'Cached plan tier for gatekeeping — enterprise unlocks Ghost Protocol';

-- Backfill subscription_tier from current_plan + active subscriptions
UPDATE public.profiles p
   SET subscription_tier = COALESCE(
     (
       SELECT s.plan
         FROM public.subscriptions s
        WHERE s.user_id = p.id
          AND s.status IN ('active', 'trialing', 'past_due')
        ORDER BY s.created_at DESC
        LIMIT 1
     ),
     NULLIF(p.current_plan, ''),
     'free'
   )
 WHERE p.subscription_tier IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IS NULL OR subscription_tier IN ('free', 'startup', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-disable ghost if operator no longer qualifies
UPDATE public.profiles
   SET is_ghost_active = false
 WHERE is_ghost_active = true
   AND (
     COALESCE(subscription_tier, current_plan, 'free') <> 'enterprise'
     OR COALESCE(access_level, 1) < 3
   );

CREATE INDEX IF NOT EXISTS idx_profiles_ghost_active
  ON public.profiles (is_ghost_active)
  WHERE is_ghost_active = true;

-- ─── 11. Stronghold completion — OTP table, code_hash repair, wallet realtime ─
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_otps_user
  ON public.verification_otps (user_id, created_at DESC);

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "verification_otps: owner read"
    ON public.verification_otps FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "verification_otps: service insert"
    ON public.verification_otps FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'code_hash'
  ) THEN
    ALTER TABLE public.verification_otps ADD COLUMN code_hash text;
    UPDATE public.verification_otps SET code_hash = code WHERE code_hash IS NULL;
    ALTER TABLE public.verification_otps ALTER COLUMN code_hash SET NOT NULL;
    ALTER TABLE public.verification_otps DROP COLUMN code;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'code'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'code_hash'
  ) THEN
    UPDATE public.verification_otps SET code_hash = COALESCE(code_hash, code) WHERE code_hash IS NULL;
    ALTER TABLE public.verification_otps DROP COLUMN IF EXISTS code;
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ─── Post-run verification queries ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'bazaar_scripts' AND column_name = 'is_certified';
-- SELECT conname FROM pg_constraint WHERE conname = 'platform_transactions_tx_type_check';
-- SELECT proname FROM pg_proc WHERE proname = 'increment_wallet';
-- SELECT id FROM storage.buckets WHERE id = 'verification-docs';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('is_ghost_active','subscription_tier');
-- SELECT to_regclass('public.verification_otps');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'verification_otps' AND column_name = 'code_hash';
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_wallets';
