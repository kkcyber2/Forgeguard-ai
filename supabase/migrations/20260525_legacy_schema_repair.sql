-- Section 12: Legacy schema repair — live DB drift (phone_number, otp_logs, replica)
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.verification_otps RENAME COLUMN phone_number TO phone;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'verification_otps'
       AND column_name = 'phone'
  ) THEN
    UPDATE public.verification_otps
       SET phone = COALESCE(phone, phone_number)
     WHERE phone IS NULL;
    ALTER TABLE public.verification_otps DROP COLUMN IF EXISTS phone_number;
  END IF;
END $$;

ALTER TABLE public.verification_otps
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;

ALTER TABLE public.otp_logs
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS error_message text;

UPDATE public.otp_logs
   SET status = COALESCE(status, action, 'queued'),
       phone = COALESCE(phone, metadata->>'phone', ''),
       provider = COALESCE(provider, metadata->>'provider'),
       error_message = COALESCE(error_message, metadata->>'error_message')
 WHERE status IS NULL OR phone IS NULL;

ALTER TABLE public.user_wallets REPLICA IDENTITY FULL;

COMMIT;
