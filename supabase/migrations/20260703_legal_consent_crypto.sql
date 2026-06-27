-- Legal consent v2 — Web Crypto SHA-256 audit fields on legal_authorizations
-- ForgeGuard AI — 2026-07-03

ALTER TABLE legal_authorizations
  ADD COLUMN IF NOT EXISTS policy_version  text        NOT NULL DEFAULT 'v1.0-2026',
  ADD COLUMN IF NOT EXISTS target_host     text,
  ADD COLUMN IF NOT EXISTS signature_hash  text        NOT NULL DEFAULT 'legacy-v1-pre-crypto',
  ADD COLUMN IF NOT EXISTS signed_at       timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN legal_authorizations.policy_version IS 'Consent policy version accepted at sign time';
COMMENT ON COLUMN legal_authorizations.target_host    IS 'Normalized hostname of scan target at sign time';
COMMENT ON COLUMN legal_authorizations.signature_hash IS 'SHA-256 hex of canonical consent payload (Web Crypto v2)';
COMMENT ON COLUMN legal_authorizations.signed_at      IS 'Client ISO timestamp embedded in consent payload';

CREATE INDEX IF NOT EXISTS idx_legal_auth_signature_hash
  ON legal_authorizations (signature_hash)
  WHERE signature_hash <> 'legacy-v1-pre-crypto';

-- Immutability: authenticated users may SELECT own rows only; writes via service role
REVOKE UPDATE, DELETE ON legal_authorizations FROM authenticated;
