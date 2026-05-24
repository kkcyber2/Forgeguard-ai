-- =============================================================================
-- Genesis 3.0 — Schema Reconciliation (live → Genesis target)
-- Idempotent additive migration; backfills from legacy column names.
-- =============================================================================

-- ─── user_wallets ───────────────────────────────────────────────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS balance_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

UPDATE public.user_wallets
   SET balance_usd = COALESCE(balance_usd, balance::numeric, 0)
 WHERE balance_usd IS NULL;

ALTER TABLE public.user_wallets
  ALTER COLUMN balance_usd SET DEFAULT 0;

UPDATE public.user_wallets SET balance_usd = 0 WHERE balance_usd IS NULL;

DO $$ BEGIN
  ALTER TABLE public.user_wallets ALTER COLUMN balance_usd SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── bazaar_scripts ─────────────────────────────────────────────────────────
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'python',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audit_verdict text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_risk_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audit_findings jsonb,
  ADD COLUMN IF NOT EXISTS audit_reason text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_usd numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.bazaar_scripts SET
  name = COALESCE(name, title, 'Untitled'),
  code = COALESCE(code, code_content, ''),
  audit_verdict = CASE
    WHEN audit_verdict IS NOT NULL AND audit_verdict NOT IN ('pending_audit') THEN audit_verdict
    WHEN status = 'cleared' OR status = 'approved' THEN 'cleared'
    WHEN status = 'rejected' THEN 'rejected'
    WHEN status = 'flagged' THEN 'flagged'
    ELSE COALESCE(audit_verdict, 'pending')
  END,
  audit_risk_score = COALESCE(audit_risk_score, safety_score, 0),
  is_published = COALESCE(is_published, status IN ('cleared', 'approved', 'published'), false),
  price_usd = COALESCE(price_usd::numeric, 0)
WHERE name IS NULL OR code IS NULL;

-- ─── bazaar_purchases ───────────────────────────────────────────────────────
ALTER TABLE public.bazaar_purchases
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount_usd numeric(8,2) DEFAULT 0;

UPDATE public.bazaar_purchases bp
   SET author_id = COALESCE(bp.author_id, bs.author_id),
       amount_usd = COALESCE(bp.amount_usd, bs.price_usd::numeric, 0)
  FROM public.bazaar_scripts bs
 WHERE bp.script_id = bs.id
   AND (bp.author_id IS NULL OR bp.amount_usd IS NULL OR bp.amount_usd = 0);

-- ─── missions ─────────────────────────────────────────────────────────────────
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS selected_hacker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.missions SET domain_verified = false WHERE domain_verified IS NULL;

-- ─── mission_proposals (view over mission_applications) ───────────────────────
CREATE TABLE IF NOT EXISTS public.mission_proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  hacker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch       text NOT NULL DEFAULT '',
  timeline    text,
  ask_credits integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, hacker_id)
);

INSERT INTO public.mission_proposals (id, mission_id, hacker_id, pitch, status, created_at)
SELECT ma.id, ma.mission_id, ma.hacker_id,
       COALESCE(ma.proposal_text, ''),
       COALESCE(ma.status, 'pending'),
       COALESCE(ma.created_at, now())
  FROM public.mission_applications ma
 WHERE NOT EXISTS (
   SELECT 1 FROM public.mission_proposals mp
   WHERE mp.mission_id = ma.mission_id AND mp.hacker_id = ma.hacker_id
 )
ON CONFLICT (mission_id, hacker_id) DO NOTHING;

ALTER TABLE public.mission_proposals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "proposals_select_reconcile" ON public.mission_proposals
    FOR SELECT TO authenticated
    USING (hacker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.client_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── legal_signatures ─────────────────────────────────────────────────────────
ALTER TABLE public.legal_signatures
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS custody_hash text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.legal_signatures
   SET signature_data = COALESCE(signature_data, signature_svg, ''),
       custody_hash = COALESCE(custody_hash, encode(sha256(COALESCE(signature_svg, id::text)::bytea), 'hex'))
 WHERE signature_data IS NULL OR custody_hash IS NULL;

-- ─── bounty_escrow (Genesis table; migrate from bounty_escrows) ───────────────
CREATE TABLE IF NOT EXISTS public.bounty_escrow (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid,
  mission_id      uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd      numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held','released','refunded','pending')),
  held_at         timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  release_note    text,
  processor       text,
  processor_ref   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounty_escrow ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "escrow_owner_read" ON public.bounty_escrow FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "escrow_service_all" ON public.bounty_escrow FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.bounty_escrow (id, submission_id, user_id, amount_usd, status, created_at)
SELECT be.id, be.bounty_id, be.hacker_id,
       COALESCE(be.amount_usd::numeric, 0),
       COALESCE(be.status, 'held'),
       COALESCE(be.created_at, now())
  FROM public.bounty_escrows be
 WHERE NOT EXISTS (SELECT 1 FROM public.bounty_escrow e WHERE e.id = be.id);

-- ─── platform_transactions ────────────────────────────────────────────────────
ALTER TABLE public.platform_transactions
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS script_id uuid REFERENCES public.bazaar_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_usd numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_payout numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tx_type text DEFAULT 'bazaar_purchase';

UPDATE public.platform_transactions
   SET buyer_id = COALESCE(buyer_id, sender_id),
       seller_id = COALESCE(seller_id, receiver_id),
       amount_usd = COALESCE(amount_usd, amount_credits::numeric, 0),
       author_payout = COALESCE(author_payout, amount_credits::numeric, 0),
       tx_type = COALESCE(tx_type, transaction_type, 'bazaar_purchase')
 WHERE buyer_id IS NULL OR seller_id IS NULL;

-- ─── terminal_inputs ──────────────────────────────────────────────────────────
ALTER TABLE public.terminal_inputs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;

UPDATE public.terminal_inputs
   SET content = COALESCE(content, input_text, ''),
       consumed = COALESCE(consumed, false)
 WHERE content IS NULL;

CREATE INDEX IF NOT EXISTS terminal_inputs_session_idx
  ON public.terminal_inputs (session_id, consumed, created_at);

-- ─── profiles active_view_mode ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_view_mode text;

UPDATE public.profiles
   SET active_view_mode = CASE
     WHEN user_type = 'client' THEN 'client'
     ELSE 'hacker'
   END
 WHERE active_view_mode IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_active_view_mode_check
    CHECK (active_view_mode IS NULL OR active_view_mode IN ('client', 'hacker'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── RPC: increment_wallet ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance_usd, balance)
  VALUES (p_user_id, GREATEST(p_amount, 0), GREATEST(p_amount::integer, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = GREATEST(public.user_wallets.balance_usd + p_amount, 0),
        balance     = GREATEST((public.user_wallets.balance_usd + p_amount)::integer, 0),
        updated_at  = now();
END;
$$;

-- ─── RPC: increment_purchase ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_purchase(
  p_script_id uuid,
  p_revenue   numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bazaar_scripts
     SET purchase_count = COALESCE(purchase_count, 0) + 1,
         revenue_usd    = COALESCE(revenue_usd, 0) + p_revenue,
         updated_at     = now()
   WHERE id = p_script_id;
END;
$$;

-- ─── RPC: atomic bazaar purchase ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purchase_bazaar_script(
  p_buyer_id  uuid,
  p_script_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_script record;
  v_balance numeric;
  v_platform_fee numeric;
  v_author_payout numeric;
  v_new_balance numeric;
BEGIN
  SELECT id, author_id, code, price_usd::numeric AS price_usd, is_published, is_removed, audit_verdict
    INTO v_script
    FROM public.bazaar_scripts
   WHERE id = p_script_id;

  IF NOT FOUND OR NOT v_script.is_published OR v_script.is_removed OR v_script.audit_verdict <> 'cleared' THEN
    RETURN jsonb_build_object('error', 'Script not available');
  END IF;

  IF v_script.author_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.bazaar_purchases WHERE script_id = p_script_id AND buyer_id = p_buyer_id) THEN
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  IF v_script.price_usd = 0 THEN
    INSERT INTO public.bazaar_purchases (script_id, buyer_id, author_id, amount_usd)
    VALUES (p_script_id, p_buyer_id, v_script.author_id, 0);
    PERFORM public.increment_purchase(p_script_id, 0);
    RETURN jsonb_build_object('ok', true, 'code', v_script.code, 'spent', 0);
  END IF;

  SELECT balance_usd INTO v_balance FROM public.user_wallets WHERE user_id = p_buyer_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < v_script.price_usd THEN
    RETURN jsonb_build_object('error', 'Insufficient funds', 'code', 'INSUFFICIENT_FUNDS');
  END IF;

  v_platform_fee := round(v_script.price_usd * 0.1, 2);
  v_author_payout := round(v_script.price_usd - v_platform_fee, 2);

  PERFORM public.increment_wallet(p_buyer_id, -v_script.price_usd);
  PERFORM public.increment_wallet(v_script.author_id, v_author_payout);

  INSERT INTO public.platform_transactions (buyer_id, seller_id, script_id, amount_usd, platform_fee, author_payout, tx_type)
  VALUES (p_buyer_id, v_script.author_id, p_script_id, v_script.price_usd, v_platform_fee, v_author_payout, 'bazaar_purchase');

  INSERT INTO public.bazaar_purchases (script_id, buyer_id, author_id, amount_usd)
  VALUES (p_script_id, p_buyer_id, v_script.author_id, v_script.price_usd);

  PERFORM public.increment_purchase(p_script_id, v_script.price_usd);

  v_new_balance := v_balance - v_script.price_usd;
  RETURN jsonb_build_object(
    'ok', true, 'code', v_script.code, 'spent', v_script.price_usd,
    'platform_fee', v_platform_fee, 'author_payout', v_author_payout, 'new_balance', v_new_balance
  );
END;
$$;
