-- Section 15: Bazaar is_free column + RLS policy repair (idempotent)
ALTER TABLE public.bazaar_scripts
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

UPDATE public.bazaar_scripts
   SET is_free = (COALESCE(price_usd, 0) = 0)
 WHERE is_free IS DISTINCT FROM (COALESCE(price_usd, 0) = 0);

COMMENT ON COLUMN public.bazaar_scripts.is_free IS
  'True when price_usd is zero — used by /api/bazaar/list free filter.';

DROP POLICY IF EXISTS "bazaar: author CRUD" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: public read published" ON public.bazaar_scripts;
DROP POLICY IF EXISTS "bazaar: service role full access" ON public.bazaar_scripts;

CREATE POLICY "bazaar: author CRUD"
  ON public.bazaar_scripts
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "bazaar: public read published"
  ON public.bazaar_scripts FOR SELECT
  USING (
    is_published = true
    AND is_removed = false
    AND audit_verdict = 'cleared'
  );

CREATE POLICY "bazaar: service role full access"
  ON public.bazaar_scripts FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchases: buyer can read own" ON public.bazaar_purchases;
DROP POLICY IF EXISTS "purchases: service role full access" ON public.bazaar_purchases;

CREATE POLICY "purchases: buyer can read own"
  ON public.bazaar_purchases FOR SELECT
  USING (buyer_id = auth.uid() OR author_id = auth.uid());

CREATE POLICY "purchases: service role full access"
  ON public.bazaar_purchases FOR ALL
  USING (true) WITH CHECK (true);
