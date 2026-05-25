-- Section 13: Aegis attack_logs — rate-limit burst telemetry
-- Idempotent; safe to run on live Supabase SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS public.attack_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  text        NOT NULL,
  path        text,
  method      text,
  user_agent  text,
  reason      text        NOT NULL DEFAULT 'rate_limit_burst',
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_attack_logs_blocked_at
  ON public.attack_logs (blocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_attack_logs_ip
  ON public.attack_logs (ip_address, blocked_at DESC);

ALTER TABLE public.attack_logs ENABLE ROW LEVEL SECURITY;

-- Service role only — no anon/authenticated policies (defense in depth)

COMMIT;
