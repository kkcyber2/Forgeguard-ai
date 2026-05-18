-- =============================================================================
-- ForgeGuard AI — Promo Code Redemption System
-- Run this in Supabase SQL Editor → New query → Run
-- =============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        UNIQUE NOT NULL,
  reward_type    text        NOT NULL DEFAULT 'plan_upgrade',
  target_plan    text        NOT NULL CHECK (target_plan IN ('startup', 'enterprise')),
  scans_to_add   integer     NOT NULL DEFAULT 1,
  uses_left      integer     NOT NULL DEFAULT 1,
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redeemed_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      uuid        NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)   -- hard block on double-redemption
);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.promo_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeemed_codes ENABLE ROW LEVEL SECURITY;

-- Admins have full access to promo_codes
CREATE POLICY "admin_all_promo_codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Any authenticated user can read promo_codes (needed to validate during redemption)
CREATE POLICY "users_read_promo_codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (true);

-- Users can record their own redemptions
CREATE POLICY "users_insert_redeemed" ON public.redeemed_codes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can check their own redemption history
CREATE POLICY "users_read_own_redeemed" ON public.redeemed_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all redemptions
CREATE POLICY "admin_read_all_redeemed" ON public.redeemed_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS promo_codes_code_idx        ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS redeemed_codes_user_idx     ON public.redeemed_codes(user_id);
CREATE INDEX IF NOT EXISTS redeemed_codes_code_id_idx  ON public.redeemed_codes(code_id);

-- ── Seed — 5 Launch Codes ───────────────────────────────────────────────────
-- 3 × Enterprise  (1-time use each)
-- 2 × Startup     (1-time use each)

INSERT INTO public.promo_codes (code, reward_type, target_plan, scans_to_add, uses_left)
VALUES
  ('FG-ENT-ALPHA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-ENT-SIGMA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-ENT-OMEGA', 'plan_upgrade', 'enterprise', 1, 1),
  ('FG-STR-DELTA', 'plan_upgrade', 'startup',    1, 1),
  ('FG-STR-GAMMA', 'plan_upgrade', 'startup',    1, 1)
ON CONFLICT (code) DO NOTHING;
