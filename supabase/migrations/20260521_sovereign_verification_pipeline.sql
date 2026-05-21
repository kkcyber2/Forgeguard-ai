-- =============================================================
-- Sovereign Verification Pipeline — Stronghold 2.0
-- =============================================================

-- ── profiles: verification columns ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clearance_tier       text NOT NULL DEFAULT 'tactical'
    CHECK (clearance_tier IN ('tactical', 'professional', 'sovereign')),
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_audit_score   numeric(5,2),
  ADD COLUMN IF NOT EXISTS identity_audit_status  text NOT NULL DEFAULT 'none'
    CHECK (identity_audit_status IN ('none','pending','passed','failed','review')),
  ADD COLUMN IF NOT EXISTS identity_audit_notes   text,
  ADD COLUMN IF NOT EXISTS sovereign_pending      boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.identity_verified IS 'True after AI audit + admin grant or auto-pass threshold';
COMMENT ON COLUMN public.profiles.clearance_tier    IS 'tactical | professional | sovereign';
COMMENT ON COLUMN public.profiles.sovereign_pending IS 'Awaiting admin GRANT ACCESS for Sovereign tier';

-- ── legal_signatures (chain of custody) ───────────────────────
CREATE TABLE IF NOT EXISTS public.legal_signatures (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signature_data  text        NOT NULL,
  custody_hash    text        NOT NULL UNIQUE,
  signed_at       timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_signatures_user ON public.legal_signatures (user_id, signed_at DESC);

ALTER TABLE public.legal_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_signatures: owner read"
  ON public.legal_signatures FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ── verification_otps ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_otps_user ON public.verification_otps (user_id, created_at DESC);

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_otps: owner read"
  ON public.verification_otps FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
