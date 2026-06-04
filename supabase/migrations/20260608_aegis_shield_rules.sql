-- Aegis Proxy shield rules (app-scoped WAF patterns for /api/v1/aegis/verify)
CREATE TABLE IF NOT EXISTS public.aegis_shield_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      text        NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern     text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  action      text        NOT NULL DEFAULT 'block'
                          CHECK (action IN ('block', 'allow', 'log')),
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aegis_shield_rules_app_id
  ON public.aegis_shield_rules (app_id)
  WHERE enabled = true;

COMMENT ON TABLE public.aegis_shield_rules IS
  'Per-app prompt shield rules for Aegis Proxy verify API';

ALTER TABLE public.aegis_shield_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own aegis_shield_rules"
  ON public.aegis_shield_rules FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes via service role (dashboard / export sync)
