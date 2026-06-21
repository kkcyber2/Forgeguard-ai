-- Lock down SECURITY DEFINER RPCs — service_role only (2026-06-22 audit)
-- Prevents anon/authenticated from calling wallet, bounty, subscription helpers via PostgREST.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_subscription_updated_at',
        'create_user_subscription',
        'set_missions_updated_at',
        'social_post_like_count_sync',
        'increment_purchase',
        'sync_scan_report_pointer',
        'increment_wallet',
        'handle_new_user_subscription',
        'set_bounty_escrow_updated_at',
        'generate_domain_token',
        'crypto_deposits_legacy_sync',
        'purchase_bazaar_script',
        'freeze_wallet',
        'increment_hacker_credits',
        'release_kinetic_bounty',
        'handle_crypto_deposit_confirmed',
        'rls_auto_enable',
        'tick_scan_counters',
        'bump_tool_execution_count',
        'handle_new_user',
        'is_admin',
        'log_activity'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;

-- Revoke from PUBLIC/anon/authenticated; grant service_role only
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_user_subscription',
        'freeze_wallet',
        'generate_domain_token',
        'handle_crypto_deposit_confirmed',
        'handle_new_user_subscription',
        'increment_hacker_credits',
        'purchase_bazaar_script',
        'release_kinetic_bounty',
        'rls_auto_enable',
        'sync_scan_report_pointer',
        'tick_scan_counters',
        'bump_tool_execution_count',
        'handle_new_user',
        'increment_wallet',
        'increment_purchase'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- is_admin + log_activity: authenticated users may call (used in RLS policies)
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

  REVOKE ALL ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Service-role-only RLS policies (replace permissive USING true for all roles)
DROP POLICY IF EXISTS "otp_logs: service all" ON public.otp_logs;
DROP POLICY IF EXISTS "otp_logs: service role all" ON public.otp_logs;
CREATE POLICY "otp_logs: service role all"
  ON public.otp_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "verification_otps: service insert" ON public.verification_otps;
DROP POLICY IF EXISTS "verification_otps: service role all" ON public.verification_otps;
CREATE POLICY "verification_otps: service role all"
  ON public.verification_otps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "escrow: service role full access" ON public.bounty_escrow;
DROP POLICY IF EXISTS "escrow_service_all" ON public.bounty_escrow;
DROP POLICY IF EXISTS "escrow_service_role_all" ON public.bounty_escrow;
CREATE POLICY "escrow_service_role_all"
  ON public.bounty_escrow FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bazaar: service role full access" ON public.bazaar_scripts;
CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "platform_tx: service role all" ON public.platform_transactions;
CREATE POLICY "platform_tx: service role all"
  ON public.platform_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions: service role all" ON public.subscriptions;
CREATE POLICY "subscriptions: service role all"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agent_memories: service role inserts" ON public.agent_memories;
DROP POLICY IF EXISTS "agent_memories: service role all" ON public.agent_memories;
CREATE POLICY "agent_memories: service role all"
  ON public.agent_memories FOR ALL TO service_role
  USING (true) WITH CHECK (true);
