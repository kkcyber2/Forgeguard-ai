-- 20260628_notification_preferences.sql
-- Per-user alerting preferences + outbound webhook registration.
-- The agathon scan.completed / scan.vector.breach webhook handlers read these
-- (service role bypasses RLS) to fan out email + signed webhook notifications.
-- Idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_on_scan_complete boolean NOT NULL DEFAULT true,
  email_on_breach       boolean NOT NULL DEFAULT true,
  webhook_url           text,
  webhook_secret        text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "notif_prefs owner read"
    ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "notif_prefs owner insert"
    ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "notif_prefs owner update"
    ON public.notification_preferences FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "notif_prefs owner delete"
    ON public.notification_preferences FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
