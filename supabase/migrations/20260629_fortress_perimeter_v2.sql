-- Fortress Perimeter v2: hashed IP blocklist + geo on perimeter_events
BEGIN;

ALTER TABLE public.perimeter_events
  ADD COLUMN IF NOT EXISTS geo_country text,
  ADD COLUMN IF NOT EXISTS threat_delta integer;

CREATE TABLE IF NOT EXISTS public.perimeter_ip_blocklist (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash      text        NOT NULL,
  reason       text        NOT NULL,
  threat_score integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  geo_country  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perimeter_ip_blocklist_hash
  ON public.perimeter_ip_blocklist (ip_hash, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_perimeter_ip_blocklist_expires
  ON public.perimeter_ip_blocklist (expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_perimeter_ip_blocklist_created
  ON public.perimeter_ip_blocklist (created_at DESC);

ALTER TABLE public.perimeter_ip_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perimeter_ip_blocklist_auth_read ON public.perimeter_ip_blocklist;
CREATE POLICY perimeter_ip_blocklist_auth_read
  ON public.perimeter_ip_blocklist
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS perimeter_ip_blocklist_service_write ON public.perimeter_ip_blocklist;
CREATE POLICY perimeter_ip_blocklist_service_write
  ON public.perimeter_ip_blocklist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.perimeter_ip_blocklist IS
  'Legal perimeter defense — hashed IP blocks with expiry (no raw IPs stored).';

COMMIT;
