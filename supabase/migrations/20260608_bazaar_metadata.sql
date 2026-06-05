-- Sovereign Customs Agent — metadata blob for remediation advice + audit replay
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bazaar_scripts.metadata IS
  'Sovereign Customs Agent output: remediation_advice, replay fields, audit metadata.';

CREATE INDEX IF NOT EXISTS idx_bazaar_scripts_metadata_gin
  ON public.bazaar_scripts USING gin (metadata);
