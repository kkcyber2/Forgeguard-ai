-- ============================================================
-- Phase 4 — Expand profiles_public for operator profile pages
-- ForgeGuard AI — 2026-06-27
-- ============================================================
-- Adds reputation, bio, avatar_url, job_title, and created_at to the
-- public view and grants anon read so the /operators/[id] page works
-- for logged-out visitors. Still no email or identity_document_path.
-- ============================================================

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
  clearance_tier,
  reputation,
  bio,
  avatar_url,
  job_title,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

COMMENT ON VIEW public.profiles_public IS
  'Non-sensitive profile fields for cross-user display. Never add email or identity_document_path.';
