-- Security Advisor repair — search_path, RPC EXECUTE, permissive RLS
-- Run in Supabase SQL Editor after prior migrations.

-- ─── 1. Immutable search_path on flagged functions ───────────────────────────
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
        'set_updated_at',
        'touch_updated_at',
        'bump_tool_execution_count',
        'increment_wallet',
        'increment_purchase',
        'purchase_bazaar_script',
        'handle_new_user',
        'is_admin',
        'log_activity'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;

-- ─── 2. Wallet / bazaar RPCs — service_role only ─────────────────────────────
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) TO service_role;

-- Legacy overload if present
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 3. SECURITY DEFINER helpers — not callable by anon ──────────────────────
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 4. Replace permissive RLS (USING true) with role-scoped policies ────────

-- otp_logs
DROP POLICY IF EXISTS "otp_logs: service all" ON public.otp_logs;
CREATE POLICY "otp_logs: service role all"
  ON public.otp_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- verification_otps
DROP POLICY IF EXISTS "verification_otps: service insert" ON public.verification_otps;
CREATE POLICY "verification_otps: service role all"
  ON public.verification_otps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- bounty_escrow
DROP POLICY IF EXISTS "escrow_service_all" ON public.bounty_escrow;
CREATE POLICY "escrow_service_role_all"
  ON public.bounty_escrow FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- bazaar_purchases
DROP POLICY IF EXISTS "purchases: service role full access" ON public.bazaar_purchases;
CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- contact_submissions: public INSERT is intentional for the marketing form.
-- Tighten admin read/update to authenticated admins only when table exists.
DO $$
BEGIN
  IF to_regclass('public.contact_submissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can view contact submissions" ON public.contact_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can update contact submissions" ON public.contact_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage contact submissions" ON public.contact_submissions';
    EXECUTE $p$
      CREATE POLICY "contact_submissions: admin read"
        ON public.contact_submissions FOR SELECT TO authenticated
        USING (public.is_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "contact_submissions: admin update"
        ON public.contact_submissions FOR UPDATE TO authenticated
        USING (public.is_admin()) WITH CHECK (public.is_admin())
    $p$;
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 5. Verification queries (run manually to confirm) ───────────────────────
-- SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'ale_usd';
-- SELECT p.proname, r.rolname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   JOIN aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
--   JOIN pg_roles r ON r.oid = a.grantee
--  WHERE n.nspname = 'public' AND p.proname IN ('increment_wallet','purchase_bazaar_script');
