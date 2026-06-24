-- P0: credit_pack wallet grant must use amount_usdt ($10), not credit_amount (100 credits marketed).

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
    IF NEW.deposit_type = 'credit_pack' THEN
      PERFORM public.increment_wallet(NEW.user_id, NEW.amount_usdt);
    ELSE
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
        period_ends_at         = now() + interval '1 month',
        updated_at             = now();
    END IF;

    NEW.credits_granted := true;
    NEW.confirmed_at    := COALESCE(NEW.confirmed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
