-- Aegis Integration — full remediation snippet + app scope on aegis_rules

ALTER TABLE public.aegis_rules
  ADD COLUMN IF NOT EXISTS rule_content text,
  ADD COLUMN IF NOT EXISTS app_id text,
  ADD COLUMN IF NOT EXISTS finding_id text;

COMMENT ON COLUMN public.aegis_rules.rule_content IS
  'Full remediation_code_snippet from scan_reports — used by /api/v1/aegis/verify';

COMMENT ON COLUMN public.aegis_rules.app_id IS
  'Aegis Proxy app scope (fg-<userId prefix>) for verify API';

CREATE INDEX IF NOT EXISTS idx_aegis_rules_app_id
  ON public.aegis_rules (app_id)
  WHERE enabled = true AND app_id IS NOT NULL;
