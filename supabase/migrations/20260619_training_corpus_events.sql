-- Training corpus — structured export events for future model fine-tuning (opt-out capable).

CREATE TABLE IF NOT EXISTS public.training_corpus_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID REFERENCES public.scans (id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'scan_completed', 'finding', 'remediation', 'attack_path', 'breach_log'
  )),
  payload_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  redacted      BOOLEAN NOT NULL DEFAULT true,
  exportable    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_corpus_events_scan_idx
  ON public.training_corpus_events (scan_id);

CREATE INDEX IF NOT EXISTS training_corpus_events_user_idx
  ON public.training_corpus_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS training_corpus_events_exportable_idx
  ON public.training_corpus_events (exportable, created_at DESC)
  WHERE exportable = true;

ALTER TABLE public.training_corpus_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_corpus_events_owner_read ON public.training_corpus_events;
CREATE POLICY training_corpus_events_owner_read
  ON public.training_corpus_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS training_corpus_events_admin_read ON public.training_corpus_events;
CREATE POLICY training_corpus_events_admin_read
  ON public.training_corpus_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- User opt-out (Settings toggle — default exportable)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_corpus_opt_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.training_corpus_opt_out IS
  'When true, scan corpus events are stored but excluded from admin JSONL export.';

-- Private bucket for admin-only JSONL exports (not public CDN)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training-corpus-private', 'training-corpus-private', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Service role handles uploads; admins download via signed URL from server action.
