-- Genesis 3.0: cookie consent + account deletion request tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cookie_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cookie_consent_version TEXT DEFAULT 'genesis-3.0',
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.cookie_consent_at IS 'When the operator accepted the cookie consent banner';
COMMENT ON COLUMN public.profiles.deletion_requested_at IS 'Soft-delete request; processed within 30 days per privacy policy';
