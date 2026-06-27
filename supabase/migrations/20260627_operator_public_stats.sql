-- ============================================================
-- Phase 4 — Public operator stats (aggregate only, no PII)
-- ForgeGuard AI — 2026-06-27
-- ============================================================
-- A SECURITY DEFINER function that returns public achievement
-- aggregates for an operator profile page. It intentionally exposes
-- ONLY counts/totals — never emails, wallet balances, or submission
-- bodies. Callable by anon + authenticated (public profile page).
-- ============================================================

CREATE OR REPLACE FUNCTION public.operator_public_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctf_solves    integer := 0;
  v_ctf_points    integer := 0;
  v_bazaar_scripts integer := 0;
  v_bounty_count  integer := 0;
  v_published     boolean := false;
BEGIN
  SELECT COALESCE(count(*), 0), COALESCE(sum(awarded_points), 0)
    INTO v_ctf_solves, v_ctf_points
  FROM public.ctf_submissions
  WHERE user_id = p_user_id AND is_correct = true;

  SELECT COALESCE(count(*), 0)
    INTO v_bazaar_scripts
  FROM public.bazaar_scripts
  WHERE author_id = p_user_id AND is_published = true AND COALESCE(is_removed, false) = false;

  SELECT COALESCE(count(*), 0)
    INTO v_bounty_count
  FROM public.platform_transactions
  WHERE seller_id = p_user_id AND tx_type = 'kinetic_bounty_paid';

  RETURN jsonb_build_object(
    'ctf_solves', v_ctf_solves,
    'ctf_points', v_ctf_points,
    'bazaar_scripts', v_bazaar_scripts,
    'bounty_count', v_bounty_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.operator_public_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_public_stats(uuid) TO anon, authenticated;
