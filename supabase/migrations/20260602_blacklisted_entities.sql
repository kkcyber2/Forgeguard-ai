-- Operation: Heavy Arsenal — scraper trap telemetry
CREATE TABLE IF NOT EXISTS public.blacklisted_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_agent text,
  reason text NOT NULL DEFAULT 'scraper_detected',
  poisoned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_entities_ip
  ON public.blacklisted_entities (ip_address, poisoned_at DESC);

ALTER TABLE public.blacklisted_entities ENABLE ROW LEVEL SECURITY;

-- Service role writes from edge middleware; sovereign admin read
CREATE POLICY "blacklisted_entities_service_all"
  ON public.blacklisted_entities
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.blacklisted_entities IS
  'Headless scrapers served Aegis CPU trap script (forgeguard middleware).';
