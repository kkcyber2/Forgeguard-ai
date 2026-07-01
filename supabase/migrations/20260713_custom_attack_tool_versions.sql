-- Developer v2: tool versioning history

ALTER TABLE public.custom_attack_tools
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.custom_attack_tool_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id     UUID NOT NULL REFERENCES public.custom_attack_tools (id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  changelog   TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tool_id, version)
);

CREATE INDEX IF NOT EXISTS custom_attack_tool_versions_tool_idx
  ON public.custom_attack_tool_versions (tool_id, version DESC);

ALTER TABLE public.custom_attack_tool_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_attack_tool_versions_author ON public.custom_attack_tool_versions;
CREATE POLICY custom_attack_tool_versions_author ON public.custom_attack_tool_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_attack_tools t
      WHERE t.id = custom_attack_tool_versions.tool_id
        AND t.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS custom_attack_tool_versions_admin ON public.custom_attack_tool_versions;
CREATE POLICY custom_attack_tool_versions_admin ON public.custom_attack_tool_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.access_level >= 5
    )
  );
