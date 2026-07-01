-- Agency ops — case notes + intel vault source reliability
-- Migration: 20260711_agency_ops.sql

CREATE TABLE IF NOT EXISTS public.agency_case_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.agency_cases (id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  body_md     TEXT NOT NULL CHECK (char_length(body_md) BETWEEN 1 AND 12000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_case_notes_case_idx
  ON public.agency_case_notes (case_id, created_at DESC);

ALTER TABLE public.agency_case_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_case_notes_member_all ON public.agency_case_notes;
CREATE POLICY agency_case_notes_member_all ON public.agency_case_notes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_cases c
      WHERE c.id = agency_case_notes.case_id
        AND public.is_agency_member(c.compartment_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_cases c
      WHERE c.id = agency_case_notes.case_id
        AND public.is_agency_member(c.compartment_id)
    )
    AND author_id = auth.uid()
  );

ALTER TABLE public.intel_vault_audit
  ADD COLUMN IF NOT EXISTS source_reliability TEXT
    CHECK (source_reliability IS NULL OR source_reliability IN ('A', 'B', 'C', 'D', 'E', 'F'));

COMMENT ON COLUMN public.intel_vault_audit.source_reliability IS
  'Admiralty-style source reliability grade for OSINT fusion.';
