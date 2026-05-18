-- =============================================================================
-- Sprint 12 — Aegis Firewall schema additions
-- =============================================================================
-- Changes:
--   user_wallets  : +is_frozen, +frozen_reason, +frozen_at (freeze gate)
--   profiles      : +hacker_rank (RECRUIT → HACKER → ELITE → TRAITOR)
--   subscriptions : new table — plan-gating for enterprise API access
--   freeze_wallet : SECURITY DEFINER RPC — atomic freeze without exposing service key
-- =============================================================================

-- ─── user_wallets: freeze columns ─────────────────────────────────────────────

ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS is_frozen     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frozen_at     timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.user_wallets.is_frozen     IS 'True when account is frozen pending admin review';
COMMENT ON COLUMN public.user_wallets.frozen_reason IS 'Human-readable reason recorded at freeze time';
COMMENT ON COLUMN public.user_wallets.frozen_at     IS 'UTC timestamp of most recent freeze event';

-- ─── profiles: hacker_rank ────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hacker_rank text NOT NULL DEFAULT 'RECRUIT'
    CHECK (hacker_rank IN ('RECRUIT','HACKER','ELITE','TRAITOR'));

COMMENT ON COLUMN public.profiles.hacker_rank IS 'Platform rank tier; TRAITOR = policy violation detected, account restricted';

-- ─── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','cancelled','past_due','trialing')),
  plan        text        NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free','pro','enterprise')),

  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz DEFAULT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can read their own subscription
CREATE POLICY "subscriptions: owner read"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Service role manages all subscriptions
CREATE POLICY "subscriptions: service role all"
  ON public.subscriptions FOR ALL
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_subscription_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

-- Auto-create free subscription on signup (matches wallet auto-creation)
CREATE OR REPLACE FUNCTION public.create_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'active', 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_subscription_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_subscription();

-- ─── freeze_wallet RPC ────────────────────────────────────────────────────────
-- Called from application layer when a policy violation is detected.
-- SECURITY DEFINER runs with elevated privileges so the route does not need
-- the service-role key exposed to the client bundle.

CREATE OR REPLACE FUNCTION public.freeze_wallet(
  p_user_id uuid,
  p_reason  text DEFAULT 'Policy violation detected'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert: create wallet row if it doesn't exist, then mark frozen
  INSERT INTO public.user_wallets (user_id, is_frozen, frozen_reason, frozen_at)
  VALUES (p_user_id, true, p_reason, now())
  ON CONFLICT (user_id) DO UPDATE
    SET is_frozen     = true,
        frozen_reason = EXCLUDED.frozen_reason,
        frozen_at     = now(),
        updated_at    = now();

  -- Also update the profile hacker_rank
  UPDATE public.profiles
  SET hacker_rank = 'TRAITOR'
  WHERE user_id = p_user_id;
END;
$$;

-- Restrict: only authenticated users may call this, but the effective
-- executor is the function owner (service). We revoke public execute
-- and rely on the server-side route (which uses the service role) to invoke it.
REVOKE ALL ON FUNCTION public.freeze_wallet(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_wallet(uuid, text) TO service_role;

-- ─── Index support ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_wallets_frozen  ON public.user_wallets (is_frozen) WHERE is_frozen = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (user_id, status, plan);

-- ─── Realtime for subscriptions ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
