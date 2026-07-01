-- Sprint arc finish: organizations, forge command registry, MFA recovery digest

CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  owner_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_owner_idx ON public.organizations (owner_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS organizations_owner_write ON public.organizations;
CREATE POLICY organizations_owner_write ON public.organizations
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.enterprise_api_keys
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.forge_command_registry (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  language    TEXT NOT NULL DEFAULT 'python',
  category    TEXT NOT NULL DEFAULT 'exploit',
  risk_tier   TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
  source      TEXT NOT NULL,
  author      TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.forge_command_registry (id, name, description, language, category, risk_tier, source, author)
VALUES
  ('homoglyph', 'Homoglyph Injection', 'Unicode confusable bypass payloads', 'python', 'auxiliary', 'medium',
   '# seeded — see lib/forge/seeded-scripts.ts', 'ForgeGuard'),
  ('markdown_exfil', 'Markdown Exfiltration', 'Covert data leakage via markdown rendering', 'python', 'auxiliary', 'high',
   '# seeded — see lib/forge/seeded-scripts.ts', 'ForgeGuard'),
  ('escalation', 'Privilege Escalation Probe', 'Role-escalation prompt battery', 'python', 'exploit', 'critical',
   '# seeded — see lib/forge/seeded-scripts.ts', 'ForgeGuard')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.forge_command_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forge_command_registry_read ON public.forge_command_registry;
CREATE POLICY forge_command_registry_read ON public.forge_command_registry
  FOR SELECT TO authenticated USING (enabled = true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_recovery_digest TEXT;

UPDATE public.platform_dev_versions
SET version = '2.0.0-xterm', updated_at = now()
WHERE component = 'forge-terminal';

UPDATE public.platform_dev_versions
SET version = '0.2.0', updated_at = now()
WHERE component = 'cli';
