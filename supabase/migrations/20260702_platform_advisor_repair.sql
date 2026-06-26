-- Platform advisor + runtime error repairs (Supabase linter + Vercel runtime logs)

-- ── 1. profiles_public: security_invoker (fixes security_definer_view ERROR) ──
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  hacker_rank,
  is_ghost_active,
  company_tag,
  domain_verified,
  company_domain,
  work_email_verified,
  identity_verified,
  sovereign_pending,
  clearance_tier
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

COMMENT ON VIEW public.profiles_public IS
  'Non-sensitive profile fields for cross-user display. security_invoker=true respects RLS on profiles.';

-- ── 2. generate_domain_token: pgcrypto lives in extensions schema ─────────────
CREATE OR REPLACE FUNCTION public.generate_domain_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := 'fgai-verify-' || encode(extensions.gen_random_bytes(16), 'hex');
  UPDATE public.profiles
     SET domain_token = v_token
   WHERE id = p_user_id;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_domain_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_domain_token(uuid) TO service_role;

-- ── 3. Bazaar author embed: FK to profiles for PostgREST (PGRST200 fix) ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bazaar_scripts_author_profiles_fkey'
  ) THEN
    ALTER TABLE public.bazaar_scripts
      ADD CONSTRAINT bazaar_scripts_author_profiles_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bazaar_scripts_author_profiles
  ON public.bazaar_scripts (author_id);

-- ── 4. RLS policies for tables with RLS enabled but zero policies ─────────────
DROP POLICY IF EXISTS "aegis_firewall_rules: service role" ON public.aegis_firewall_rules;
CREATE POLICY "aegis_firewall_rules: service role"
  ON public.aegis_firewall_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "aegis_firewall_rules: client read" ON public.aegis_firewall_rules;
CREATE POLICY "aegis_firewall_rules: client read"
  ON public.aegis_firewall_rules FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "aegis_firewall_rules: client write" ON public.aegis_firewall_rules;
CREATE POLICY "aegis_firewall_rules: client write"
  ON public.aegis_firewall_rules FOR ALL TO authenticated
  USING (client_id = auth.uid() OR public.is_admin())
  WITH CHECK (client_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "black_hole_telemetry: service role" ON public."black-hole_telemetry";
CREATE POLICY "black_hole_telemetry: service role"
  ON public."black-hole_telemetry" FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 5. verification-docs: drop broad listing policy (public bucket URLs still work) ─
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- ── 6. crypto_deposits legacy sync hardening ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.crypto_deposits_legacy_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deposit_address IS NOT NULL AND (NEW.address_generated IS NULL OR NEW.address_generated = '') THEN
    NEW.address_generated := NEW.deposit_address;
  ELSIF NEW.address_generated IS NOT NULL AND (NEW.deposit_address IS NULL OR NEW.deposit_address = '') THEN
    NEW.deposit_address := NEW.address_generated;
  END IF;

  IF NEW.address_generated IS NULL OR NEW.address_generated = '' THEN
    RAISE EXCEPTION 'crypto_deposits requires deposit_address or address_generated';
  END IF;

  IF NEW.amount_usdt IS NOT NULL AND (NEW.amount_usd IS NULL OR NEW.amount_usd = 0) THEN
    NEW.amount_usd := NEW.amount_usdt;
  ELSIF NEW.amount_usd IS NOT NULL AND (NEW.amount_usdt IS NULL OR NEW.amount_usdt = 0) THEN
    NEW.amount_usdt := NEW.amount_usd;
  END IF;

  RETURN NEW;
END;
$$;
