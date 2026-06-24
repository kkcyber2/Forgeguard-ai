-- Phase 4: Citadel Intel Vault — legal OSINT queries + results + audit

CREATE TABLE IF NOT EXISTS public.intel_vault_queries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scan_id        UUID REFERENCES public.scans (id) ON DELETE SET NULL,
  query_type     TEXT NOT NULL
    CHECK (query_type IN ('dns', 'whois', 'certs', 'robots', 'security_txt', 'headers')),
  target_domain  TEXT NOT NULL CHECK (char_length(target_domain) BETWEEN 1 AND 253),
  status         TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intel_vault_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id       UUID NOT NULL REFERENCES public.intel_vault_queries (id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scan_id        UUID REFERENCES public.scans (id) ON DELETE SET NULL,
  query_type     TEXT NOT NULL
    CHECK (query_type IN ('dns', 'whois', 'certs', 'robots', 'security_txt', 'headers')),
  target_domain  TEXT NOT NULL,
  result         JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intel_vault_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  query_id   UUID REFERENCES public.intel_vault_queries (id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intel_vault_queries_user_created_idx
  ON public.intel_vault_queries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intel_vault_queries_scan_idx
  ON public.intel_vault_queries (scan_id) WHERE scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS intel_vault_results_user_created_idx
  ON public.intel_vault_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intel_vault_results_scan_idx
  ON public.intel_vault_results (scan_id) WHERE scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS intel_vault_audit_user_created_idx
  ON public.intel_vault_audit (user_id, created_at DESC);

ALTER TABLE public.intel_vault_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_vault_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_vault_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intel_vault_queries_select_own ON public.intel_vault_queries;
CREATE POLICY intel_vault_queries_select_own ON public.intel_vault_queries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_queries_insert_own ON public.intel_vault_queries;
CREATE POLICY intel_vault_queries_insert_own ON public.intel_vault_queries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_queries_update_own ON public.intel_vault_queries;
CREATE POLICY intel_vault_queries_update_own ON public.intel_vault_queries
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_results_select_own ON public.intel_vault_results;
CREATE POLICY intel_vault_results_select_own ON public.intel_vault_results
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_results_insert_own ON public.intel_vault_results;
CREATE POLICY intel_vault_results_insert_own ON public.intel_vault_results
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_audit_select_own ON public.intel_vault_audit;
CREATE POLICY intel_vault_audit_select_own ON public.intel_vault_audit
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_audit_insert_own ON public.intel_vault_audit;
CREATE POLICY intel_vault_audit_insert_own ON public.intel_vault_audit
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_audit_select_moderator ON public.intel_vault_audit;
CREATE POLICY intel_vault_audit_select_moderator ON public.intel_vault_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.access_level, 0) >= 4
    )
  );
