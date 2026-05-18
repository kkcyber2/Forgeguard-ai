-- ============================================================
-- Sprint 8: Identity & Legal Handshake Gate
-- ForgeGuard AI — 2026-05-17
-- ============================================================

-- ─── 1. Profile Identity Columns ───────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type        text    NOT NULL DEFAULT 'hacker'
                                            CHECK (user_type IN ('client', 'hacker', 'developer')),
  ADD COLUMN IF NOT EXISTS access_level     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS domain_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain_token     text;

COMMENT ON COLUMN profiles.user_type       IS 'Self-selected identity: client | hacker | developer';
COMMENT ON COLUMN profiles.access_level    IS '1=Client, 2=Hacker, 3=Developer';
COMMENT ON COLUMN profiles.domain_verified IS 'True after DNS TXT record verification passes';
COMMENT ON COLUMN profiles.domain_token    IS 'Random token placed in DNS TXT record for verification';

-- Index for fast leaderboard filtering by type
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles (user_type);

-- ─── 2. legal_authorizations Table ─────────────────────────

CREATE TABLE IF NOT EXISTS legal_authorizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scan_id     uuid        REFERENCES scans (id) ON DELETE SET NULL,
  full_name   text        NOT NULL,
  ip_address  text        NOT NULL,
  user_agent  text,
  intensity   text        NOT NULL CHECK (intensity IN ('high', 'nuclear')),
  consented   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  legal_authorizations                IS 'Legal consent records for High/Nuclear intensity scans';
COMMENT ON COLUMN legal_authorizations.full_name      IS 'User-supplied legal name at time of authorization';
COMMENT ON COLUMN legal_authorizations.ip_address     IS 'Client IP captured server-side at submission';
COMMENT ON COLUMN legal_authorizations.intensity      IS 'Scan intensity level that required authorization';

-- Fast lookup: most recent auth for a user
CREATE INDEX IF NOT EXISTS idx_legal_auth_user_id    ON legal_authorizations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_auth_scan_id    ON legal_authorizations (scan_id);

-- ─── 3. Row Level Security ──────────────────────────────────

ALTER TABLE legal_authorizations ENABLE ROW LEVEL SECURITY;

-- Users can only read their own authorizations
CREATE POLICY "Users read own legal_authorizations"
  ON legal_authorizations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert via service-role only (Server Action uses admin client)
-- No INSERT policy for authenticated — writes go through admin client

-- Admins (service role) bypass RLS by default

-- ─── 4. Refresh profiles_with_rank VIEW ─────────────────────
-- Drop and recreate to include new columns

DROP VIEW IF EXISTS profiles_with_rank;

CREATE OR REPLACE VIEW profiles_with_rank AS
SELECT
  p.*,
  CASE
    WHEN p.reputation >= 1000 THEN 'Legend'
    WHEN p.reputation >= 100  THEN 'Elite'
    ELSE                           'Recruit'
  END                                              AS rank_label,
  CASE
    WHEN p.reputation >= 1000 THEN
      LEAST(100, ((p.reputation - 1000)::numeric / 9000) * 100)
    WHEN p.reputation >= 100 THEN
      ((p.reputation - 100)::numeric / 900) * 100
    ELSE
      (p.reputation::numeric / 100) * 100
  END                                              AS rank_progress,
  CASE
    WHEN p.reputation >= 1000 THEN 10000
    WHEN p.reputation >= 100  THEN 1000
    ELSE                           100
  END                                              AS rank_ceiling
FROM profiles p;

COMMENT ON VIEW profiles_with_rank IS 'Profiles enriched with rank label, progress, and ceiling — includes Sprint 8 identity columns';

-- ─── 5. Helper: generate_domain_token() ────────────────────
-- Called by the domain-verify Server Action to stamp a token

CREATE OR REPLACE FUNCTION generate_domain_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := 'fgai-verify-' || encode(gen_random_bytes(16), 'hex');
  UPDATE profiles
     SET domain_token = v_token
   WHERE id = p_user_id;
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION generate_domain_token IS 'Generates and persists a DNS verification token for domain ownership proof';
