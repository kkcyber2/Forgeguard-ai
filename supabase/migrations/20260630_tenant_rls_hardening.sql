-- P0 tenant isolation: remove permissive public read policies on scans + scan_reports.
-- Also store crypto pay_amount for wallet QR reconciliation.

-- ── Drop dangerous public-read policies ───────────────────────────────────────
DROP POLICY IF EXISTS "Public SEO view" ON public.scans;
DROP POLICY IF EXISTS "Public view reports" ON public.scan_reports;

-- ── Ensure authenticated users only see own scans (idempotent) ──────────────
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scans_select_own_or_admin ON public.scans;
CREATE POLICY scans_select_own_or_admin
  ON public.scans
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS scans_insert_own ON public.scans;
CREATE POLICY scans_insert_own
  ON public.scans
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS scans_update_own_or_admin ON public.scans;
CREATE POLICY scans_update_own_or_admin
  ON public.scans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS scans_delete_own_or_admin ON public.scans;
CREATE POLICY scans_delete_own_or_admin
  ON public.scans
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ── scan_logs: SELECT only via owned scans ───────────────────────────────────
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_logs_select_via_scan ON public.scan_logs;
CREATE POLICY scan_logs_select_via_scan
  ON public.scan_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_logs.scan_id
        AND (s.user_id = auth.uid() OR public.is_admin())
    )
  );

-- ── scan_reports: tenant-scoped SELECT only ──────────────────────────────────
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_reports_via_scan ON public.scan_reports;
CREATE POLICY scan_reports_via_scan
  ON public.scan_reports
  FOR SELECT
  TO authenticated
  USING (
    scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- ── crypto_deposits: persist NOWPayments crypto amount ───────────────────────
ALTER TABLE public.crypto_deposits
  ADD COLUMN IF NOT EXISTS pay_amount numeric;

UPDATE public.crypto_deposits
   SET pay_amount = COALESCE(pay_amount, amount_usdt)
 WHERE pay_amount IS NULL;
