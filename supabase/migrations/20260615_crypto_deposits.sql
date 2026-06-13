-- Sovereign crypto deposit rail — USDT/SOL/BTC via NOWPayments
-- When status → confirmed, increment_wallet + activate subscription.

CREATE TABLE IF NOT EXISTS public.crypto_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_name       text NOT NULL,
  plan_id         text NOT NULL CHECK (plan_id IN ('startup', 'enterprise')),
  amount_usdt     numeric NOT NULL CHECK (amount_usdt > 0),
  deposit_address text NOT NULL,
  pay_currency    text NOT NULL DEFAULT 'usdttrc20',
  payment_id      text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirming', 'confirmed', 'expired', 'failed')),
  credits_granted boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  confirmed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS crypto_deposits_user_id_idx
  ON public.crypto_deposits (user_id);

CREATE INDEX IF NOT EXISTS crypto_deposits_payment_id_idx
  ON public.crypto_deposits (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crypto_deposits_select_own ON public.crypto_deposits;
CREATE POLICY crypto_deposits_select_own
  ON public.crypto_deposits
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Trigger: confirmed deposit → wallet + subscription ─────────────────────

CREATE OR REPLACE FUNCTION public.handle_crypto_deposit_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
     AND NOT NEW.credits_granted
  THEN
    PERFORM public.increment_wallet(NEW.user_id, NEW.amount_usdt);

    INSERT INTO public.subscriptions (
      user_id,
      plan,
      status,
      scans_used_this_period,
      period_starts_at,
      period_ends_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      NEW.plan_id,
      'active',
      0,
      now(),
      now() + interval '1 month',
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan                   = EXCLUDED.plan,
      status                 = 'active',
      scans_used_this_period = 0,
      period_starts_at       = now(),
      period_ends_at           = now() + interval '1 month',
      updated_at             = now();

    NEW.credits_granted := true;
    NEW.confirmed_at    := COALESCE(NEW.confirmed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crypto_deposit_confirmed_trigger ON public.crypto_deposits;
CREATE TRIGGER crypto_deposit_confirmed_trigger
  BEFORE INSERT OR UPDATE OF status ON public.crypto_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_crypto_deposit_confirmed();
