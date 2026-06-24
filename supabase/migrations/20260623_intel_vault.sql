-- Phase 4: Citadel Intel Vault — legal OSINT submissions with moderation

CREATE TABLE IF NOT EXISTS public.intel_vault_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  source_url          TEXT,
  summary_md          TEXT NOT NULL CHECK (char_length(summary_md) BETWEEN 20 AND 8000),
  category            TEXT NOT NULL DEFAULT 'osint'
    CHECK (category IN ('osint', 'cve', 'advisory', 'technique', 'tooling')),
  legal_attestation   BOOLEAN NOT NULL DEFAULT false,
  moderation_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_notes    TEXT,
  moderated_by        UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  moderated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intel_vault_items_status_idx
  ON public.intel_vault_items (moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS intel_vault_items_user_idx
  ON public.intel_vault_items (user_id, created_at DESC);

ALTER TABLE public.intel_vault_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intel_vault_read_approved ON public.intel_vault_items;
CREATE POLICY intel_vault_read_approved ON public.intel_vault_items
  FOR SELECT TO authenticated
  USING (moderation_status = 'approved' OR user_id = auth.uid());

DROP POLICY IF EXISTS intel_vault_insert_own ON public.intel_vault_items;
CREATE POLICY intel_vault_insert_own ON public.intel_vault_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND legal_attestation = true
    AND moderation_status = 'pending'
  );

DROP POLICY IF EXISTS intel_vault_admin_moderate ON public.intel_vault_items;
CREATE POLICY intel_vault_admin_moderate ON public.intel_vault_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.access_level, 0) >= 4
    )
  );
