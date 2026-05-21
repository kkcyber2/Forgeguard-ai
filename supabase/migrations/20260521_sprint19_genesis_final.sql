-- Sprint 19: Genesis Final — platform_transactions + clearance pending tier

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_clearance_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_clearance_tier_check
  CHECK (clearance_tier IN ('pending', 'tactical', 'professional', 'sovereign'));

CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  script_id     uuid          REFERENCES public.bazaar_scripts(id) ON DELETE SET NULL,
  amount_usd    numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee  numeric(12,2) NOT NULL DEFAULT 0,
  author_payout numeric(12,2) NOT NULL DEFAULT 0,
  tx_type       text          NOT NULL DEFAULT 'bazaar_purchase'
                CHECK (tx_type IN ('bazaar_purchase', 'bounty_release', 'top_up', 'refund')),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_tx_buyer ON public.platform_transactions (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_tx_seller ON public.platform_transactions (seller_id, created_at DESC);

ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_tx: participants read"
  ON public.platform_transactions FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "platform_tx: service role all"
  ON public.platform_transactions FOR ALL
  USING (true) WITH CHECK (true);
