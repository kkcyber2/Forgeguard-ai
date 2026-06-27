-- ============================================================
-- NOWPayments invoice flow — order_id + invoice_url on crypto_deposits
-- ForgeGuard AI — 2026-06-27
-- ============================================================
-- Switches checkout from white-label /v1/payment (QR + modal) to
-- /v1/invoice (hosted page redirect). Invoice IPNs carry our order_id,
-- so we match the webhook by order_id (with payment_id fallback).
-- ============================================================

ALTER TABLE public.crypto_deposits
  ADD COLUMN IF NOT EXISTS order_id    text,
  ADD COLUMN IF NOT EXISTS invoice_url text;

COMMENT ON COLUMN public.crypto_deposits.order_id    IS 'NOWPayments order_id used to match invoice IPNs';
COMMENT ON COLUMN public.crypto_deposits.invoice_url IS 'NOWPayments hosted invoice URL the user is redirected to';

CREATE INDEX IF NOT EXISTS idx_crypto_deposits_order_id
  ON public.crypto_deposits (order_id)
  WHERE order_id IS NOT NULL;
