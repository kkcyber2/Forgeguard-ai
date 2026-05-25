-- Operation: Iron Wall — Verification Pipeline schema repair
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

-- ─── ISSUE 1: Corporate verification columns on profiles ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_domain      text,
  ADD COLUMN IF NOT EXISTS company_tag         text,
  ADD COLUMN IF NOT EXISTS domain_token        text,
  ADD COLUMN IF NOT EXISTS domain_verify_token text,
  ADD COLUMN IF NOT EXISTS domain_verified     boolean NOT NULL DEFAULT false;

-- Reconcile legacy column names
UPDATE public.profiles
   SET domain_token = COALESCE(domain_token, domain_verify_token)
 WHERE domain_token IS NULL AND domain_verify_token IS NOT NULL;

UPDATE public.profiles
   SET domain_verify_token = COALESCE(domain_verify_token, domain_token)
 WHERE domain_verify_token IS NULL AND domain_token IS NOT NULL;

-- ─── ISSUE 2: OTP queue + audit log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_otps_user
  ON public.verification_otps (user_id, created_at DESC);

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "verification_otps: owner read"
    ON public.verification_otps FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "verification_otps: service insert"
    ON public.verification_otps FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.otp_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  phone        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'sent', 'failed', 'verified', 'expired')),
  provider     text,
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_logs_user
  ON public.otp_logs (user_id, created_at DESC);

ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "otp_logs: owner read"
    ON public.otp_logs FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "otp_logs: service all"
    ON public.otp_logs FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime wallet sync (Issue 4)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
