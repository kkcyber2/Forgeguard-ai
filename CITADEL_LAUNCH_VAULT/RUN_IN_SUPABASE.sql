-- =============================================================================
-- FORGEGUARD — RUN THIS ONE FILE IN SUPABASE SQL EDITOR
-- =============================================================================
-- IMPORTANT: Cursor / your local dev environment is NOT connected to Supabase.
-- KK must paste and execute this entire script manually in:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- Idempotent: safe to re-run on partially migrated projects.
-- Includes: Admin Command Center, Persona Switcher, Iron Wall, Ghost Protocol, Stronghold completion.
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

-- ─── 6. Realtime: scan_logs + scans ───────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 7. Storage: verification-docs bucket ────────────────────────────────────
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
  'Cached plan tier — enterprise + rank 3+ unlocks Ghost Protocol toggle';

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

-- Legacy repair: migrate old `code` column to `code_hash`
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

-- Realtime wallet sync (required for postgres_changes on user_wallets)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 12. Legacy schema repair — live DB drift (phone_number, otp_logs, replica) ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.verification_otps RENAME COLUMN phone_number TO phone;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    UPDATE public.verification_otps
       SET phone = COALESCE(phone, phone_number)
     WHERE phone IS NULL;
    ALTER TABLE public.verification_otps DROP COLUMN IF EXISTS phone_number;
  END IF;
END $$;

ALTER TABLE public.verification_otps
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;

ALTER TABLE public.otp_logs
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS error_message text;

UPDATE public.otp_logs
   SET status = COALESCE(status, action, 'queued'),
       phone = COALESCE(phone, metadata->>'phone', ''),
       provider = COALESCE(provider, metadata->>'provider'),
       error_message = COALESCE(error_message, metadata->>'error_message')
 WHERE status IS NULL OR phone IS NULL;

ALTER TABLE public.user_wallets REPLICA IDENTITY FULL;

-- ─── 13. Aegis attack_logs — rate-limit burst telemetry ───────────────────────
CREATE TABLE IF NOT EXISTS public.attack_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  text        NOT NULL,
  path        text,
  method      text,
  user_agent  text,
  reason      text        NOT NULL DEFAULT 'rate_limit_burst',
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_attack_logs_blocked_at
  ON public.attack_logs (blocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_attack_logs_ip
  ON public.attack_logs (ip_address, blocked_at DESC);

ALTER TABLE public.attack_logs ENABLE ROW LEVEL SECURITY;

-- ─── 14. ForgeGuard Certified bazaar seed (5 scripts) ───────────────────────
DO $$
DECLARE
  v_author uuid;
BEGIN
  SELECT id INTO v_author FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_author IS NULL THEN
    RAISE NOTICE 'Section 14 skipped — no profiles row for author_id';
    RETURN;
  END IF;

  INSERT INTO public.bazaar_scripts (
    id, name, title, description, code, language, tags,
    author_id, is_certified, audit_verdict, is_published, is_removed,
    price_usd, audit_risk_score, safety_score, purchase_count
  ) VALUES
  (
    'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
    'llm-jailbreak-probe',
    'LLM Jailbreak Probe',
    'Multi-vector jailbreak harness for LLM guardrail evaluation and red-team probing.',
    '# ForgeGuard Certified — LLM Jailbreak Probe\nprint("jailbreak probe ready")',
    'python',
    ARRAY['llm', 'jailbreak', 'red-team'],
    v_author, true, 'cleared', true, false, 13, 22, 92, 156
  ),
  (
    'aaaaaaaa-0002-4000-8000-000000000002'::uuid,
    'rag-injection-scanner',
    'RAG Injection Scanner',
    'Detects document-poisoning and retrieval injection vectors in RAG pipelines.',
    '# ForgeGuard Certified — RAG Injection Scanner\nprint("rag scanner ready")',
    'python',
    ARRAY['rag', 'injection', 'llm'],
    v_author, true, 'cleared', true, false, 15, 35, 88, 98
  ),
  (
    'aaaaaaaa-0003-4000-8000-000000000003'::uuid,
    'prompt-exfil-kit',
    'Prompt Exfil Kit',
    'Structured prompt exfiltration toolkit for system-prompt and secret leakage tests.',
    '# ForgeGuard Certified — Prompt Exfil Kit\nprint("exfil kit ready")',
    'python',
    ARRAY['prompt', 'exfil', 'llm'],
    v_author, true, 'cleared', true, false, 10, 41, 85, 203
  ),
  (
    'aaaaaaaa-0004-4000-8000-000000000004'::uuid,
    'agent-tool-hijack',
    'Agent Tool Hijack',
    'Simulates tool-calling hijacks against autonomous agent frameworks.',
    '# ForgeGuard Certified — Agent Tool Hijack\nprint("tool hijack ready")',
    'javascript',
    ARRAY['agent', 'tool-calling', 'hijack'],
    v_author, true, 'cleared', true, false, 12, 48, 90, 74
  ),
  (
    'aaaaaaaa-0005-4000-8000-000000000005'::uuid,
    'multi-turn-bypass',
    'Multi-Turn Bypass',
    'Progressive multi-turn bypass sequences for conversational guardrail evasion.',
    '# ForgeGuard Certified — Multi-Turn Bypass\nprint("multi-turn bypass ready")',
    'python',
    ARRAY['multi-turn', 'bypass', 'llm'],
    v_author, true, 'cleared', true, false, 9, 38, 87, 131
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    code = EXCLUDED.code,
    language = EXCLUDED.language,
    tags = EXCLUDED.tags,
    is_certified = EXCLUDED.is_certified,
    audit_verdict = EXCLUDED.audit_verdict,
    is_published = EXCLUDED.is_published,
    is_removed = EXCLUDED.is_removed,
    price_usd = EXCLUDED.price_usd,
    audit_risk_score = EXCLUDED.audit_risk_score,
    safety_score = EXCLUDED.safety_score,
    purchase_count = EXCLUDED.purchase_count,
    updated_at = now();
END $$;

-- ─── 15. Bazaar is_free column + RLS policy repair (future-proof) ───────────
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

UPDATE public.bazaar_scripts
   SET is_free = (COALESCE(price_usd, 0) = 0)
 WHERE is_free IS DISTINCT FROM (COALESCE(price_usd, 0) = 0);

COMMENT ON COLUMN public.bazaar_scripts.is_free IS
  'True when price_usd is zero — used by /api/bazaar/list free filter.';

-- bazaar_scripts: idempotent RLS restore (RLS ON with zero policies blocks all reads)
DROP POLICY IF EXISTS "bazaar: author CRUD" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: public read published" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: service role full access" ON public.bazaar_scripts;

CREATE POLICY "bazaar: author CRUD"
  ON public.bazaar_scripts
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "bazaar: public read published"
  ON public.bazaar_scripts FOR SELECT
  USING (
    is_published = true
    AND is_removed = false
    AND audit_verdict = 'cleared'
  );

CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL
  USING (true) WITH CHECK (true);

-- bazaar_purchases: idempotent RLS restore
DROP POLICY IF EXISTS "purchases: buyer can read own" ON public.bazaar_purchases;
DROP POLICY IF EXISTS "purchases: service role full access" ON public.bazaar_purchases;

CREATE POLICY "purchases: buyer can read own"
  ON public.bazaar_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR author_id = auth.uid());

CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL
  USING (true) WITH CHECK (true);

COMMIT;

-- =============================================================================
-- POST-RUN VERIFICATION (run these SELECTs after COMMIT succeeds)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'profiles'
--    AND column_name IN ('is_ghost_active','subscription_tier','current_persona','company_domain');
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'bazaar_scripts' AND column_name = 'is_certified';
--
-- SELECT proname FROM pg_proc WHERE proname = 'increment_wallet';
-- SELECT id FROM storage.buckets WHERE id = 'verification-docs';
-- SELECT to_regclass('public.otp_logs');
-- SELECT to_regclass('public.verification_otps');
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'verification_otps'
--    AND column_name = 'code_hash';
-- SELECT tablename FROM pg_publication_tables
--  WHERE pubname = 'supabase_realtime' AND tablename = 'user_wallets';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'verification_otps'
--    AND column_name IN ('phone', 'code_hash', 'consumed');
-- SELECT relreplident FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relname = 'user_wallets';
-- SELECT to_regclass('public.attack_logs');
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'attack_logs';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'bazaar_scripts' AND column_name = 'is_free';
-- SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bazaar_scripts';
