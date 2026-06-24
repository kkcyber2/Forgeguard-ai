-- Live Command Map v2: Fortress perimeter pulses (hashed IP, geo, severity)
BEGIN;

CREATE TABLE IF NOT EXISTS public.perimeter_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash     text        NOT NULL,
  path        text,
  severity    text        NOT NULL DEFAULT 'medium',
  geo_lat     double precision NOT NULL,
  geo_lng     double precision NOT NULL,
  reason      text,
  source      text        NOT NULL DEFAULT 'fortress',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perimeter_events_created_at
  ON public.perimeter_events (created_at DESC);

ALTER TABLE public.perimeter_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perimeter_events_auth_read ON public.perimeter_events;
CREATE POLICY perimeter_events_auth_read
  ON public.perimeter_events
  FOR SELECT
  TO authenticated
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.perimeter_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
