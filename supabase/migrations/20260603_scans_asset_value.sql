-- Estimated data-access value for $ALE liability calculation
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS asset_value_usd numeric(14, 2);

COMMENT ON COLUMN public.scans.asset_value_usd IS
  'Operator-estimated USD value of data at risk; feeds kinetic $ALE judge';
