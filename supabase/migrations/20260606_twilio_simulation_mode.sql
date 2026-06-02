-- Platform flags (service-role only) — Twilio simulation for launch without live SMS.

CREATE TABLE IF NOT EXISTS public.platform_flags (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_flags: service role all" ON public.platform_flags;
CREATE POLICY "platform_flags: service role all"
  ON public.platform_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.platform_flags (key, value)
VALUES ('twilio_simulation_mode', true)
ON CONFLICT (key) DO NOTHING;
