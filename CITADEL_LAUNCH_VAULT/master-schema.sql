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

COMMIT;

-- ─── Post-run verification queries ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'bazaar_scripts' AND column_name = 'is_certified';
-- SELECT conname FROM pg_constraint WHERE conname = 'platform_transactions_tx_type_check';
-- SELECT proname FROM pg_proc WHERE proname = 'increment_wallet';
-- SELECT id FROM storage.buckets WHERE id = 'verification-docs';
