-- Sprint 24: Kinetic bounty payout RPC + ledger tx type

ALTER TABLE public.platform_transactions
  DROP CONSTRAINT IF EXISTS platform_transactions_tx_type_check;

ALTER TABLE public.platform_transactions
  ADD CONSTRAINT platform_transactions_tx_type_check
  CHECK (tx_type IN (
    'bazaar_purchase',
    'bounty_release',
    'escrow_hold',
    'kinetic_bounty_paid',
    'top_up',
    'refund'
  ));

CREATE OR REPLACE FUNCTION public.release_kinetic_bounty(p_escrow_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow public.bounty_escrow%ROWTYPE;
  v_ale numeric := 0;
  v_payout numeric := 0;
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

  -- Resolve ALE: submission_id may reference scan_id
  IF v_escrow.submission_id IS NOT NULL THEN
    SELECT COALESCE(sr.financial_liability_usd, sr.ale_usd, 0)
      INTO v_ale
    FROM public.scan_reports sr
    WHERE sr.scan_id = v_escrow.submission_id
    LIMIT 1;
  END IF;

  -- Fallback: highest ALE sealed scan by hacker
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

  v_payout := ROUND(COALESCE(v_ale, 0) / 10.0, 2);

  IF v_payout <= 0 THEN
    v_payout := v_escrow.amount_usd;
  END IF;

  IF v_payout > v_escrow.amount_usd THEN
    v_payout := v_escrow.amount_usd;
  END IF;

  PERFORM public.increment_wallet(v_escrow.user_id, v_payout);

  UPDATE public.bounty_escrow
     SET status = 'released',
         released_at = now(),
         release_note = 'KINETIC_BOUNTY_PAID $' || v_payout::text
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
    v_payout,
    ROUND(v_payout),
    v_payout,
    0,
    'kinetic_bounty_paid'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payout', v_payout,
    'financial_liability_usd', v_ale,
    'event', 'KINETIC_BOUNTY_PAID'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_kinetic_bounty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_kinetic_bounty(uuid) TO service_role;
