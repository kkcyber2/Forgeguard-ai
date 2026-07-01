-- Dev versioning stamp for Citadel compartment rollout
-- Migration: 20260712_dev_versioning.sql

CREATE TABLE IF NOT EXISTS public.platform_dev_versions (
  component   TEXT PRIMARY KEY,
  version     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_dev_versions (component, version)
VALUES
  ('citadel', '1.0.0-compartment-zero'),
  ('cli', '0.1.0-stub'),
  ('forge-terminal', '0.1.0-stub')
ON CONFLICT (component) DO UPDATE
  SET version = EXCLUDED.version, updated_at = now();

ALTER TABLE public.platform_dev_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_dev_versions_read ON public.platform_dev_versions;
CREATE POLICY platform_dev_versions_read ON public.platform_dev_versions
  FOR SELECT TO authenticated USING (true);

-- Leaderboard fix: expose reputation on profiles_public
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  hacker_rank,
  reputation,
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
