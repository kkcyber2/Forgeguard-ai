-- Safe public profile fields for social feed / leaderboards (no email, no KYC paths).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_email_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
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
  'Non-sensitive profile fields for cross-user display. Never add email or identity_document_path.';
