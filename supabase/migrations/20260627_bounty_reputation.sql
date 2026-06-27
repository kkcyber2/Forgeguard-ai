-- ============================================================
-- Phase 4 — Bounty release awards reputation to the researcher
-- ForgeGuard AI — 2026-06-27
-- ============================================================
-- Re-creates release_kinetic_bounty (latest shape from
-- 20260612_hacker_wallet_payout.sql) and adds a reputation award
-- equal to the credits granted, via the reusable increment_reputation
-- SECURITY DEFINER function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_kinetic_bounty(p_escrow_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.bounty_escrow%ROWTYPE;
  v_ale numeric := 0;
  v_gross numeric := 0;
  v_fee numeric := 0;
  v_net numeric := 0;
  v_credits integer := 0;
BEGIN
  SELECT * INTO v_escrow
  FROM public.bounty_escrow
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow not found');
  END IF;

  IF v_escrow.status <> 'held' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Escrow is not in held status');
  END IF;

  IF v_escrow.submission_id IS NOT NULL THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scan_reports sr
    WHERE sr.scan_id = v_escrow.submission_id
    LIMIT 1;
  END IF;

  IF COALESCE(v_ale, 0) <= 0 THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scans s
    JOIN public.scan_reports sr ON sr.scan_id = s.id
    WHERE s.user_id = v_escrow.user_id
      AND s.status = 'sealed'
    ORDER BY COALESCE(sr.financial_liability_usd, sr.ale_usd, 0) DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_gross := ROUND(COALESCE(v_ale, 0) / 10.0, 2);

  IF v_gross <= 0 THEN
    v_gross := v_escrow.amount_usd;
  END IF;

  IF v_gross > v_escrow.amount_usd THEN
    v_gross := v_escrow.amount_usd;
  END IF;

  v_fee := ROUND(v_gross * 0.10, 2);
  v_net := ROUND(v_gross - v_fee, 2);
  v_credits := GREATEST(ROUND(v_net), 0);

  PERFORM public.increment_hacker_credits(v_escrow.user_id, v_credits);
  PERFORM public.increment_wallet(v_escrow.user_id, v_net);

  -- Phase 4: researcher reputation award equal to credits granted.
  PERFORM public.increment_reputation(v_escrow.user_id, v_credits);

  UPDATE public.bounty_escrow
     SET status = 'released',
         released_at = now(),
         release_note = 'KINETIC_BOUNTY_PAID gross=$' || v_gross::text
           || ' fee=$' || v_fee::text || ' credits=' || v_credits::text
           || ' rep=' || v_credits::text
   WHERE id = p_escrow_id;

  INSERT INTO public.platform_transactions (
    seller_id,
    amount_usd,
    amount_credits,
    author_payout,
    platform_fee,
    tx_type
  ) VALUES (
    v_escrow.user_id,
    v_gross,
    v_credits,
    v_net,
    v_fee,
    'kinetic_bounty_paid'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payout', v_net,
    'gross', v_gross,
    'platform_fee', v_fee,
    'credits', v_credits,
    'reputation', v_credits,
    'financial_liability_usd', v_ale,
    'event', 'KINETIC_BOUNTY_PAID'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_kinetic_bounty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_kinetic_bounty(uuid) TO service_role;
