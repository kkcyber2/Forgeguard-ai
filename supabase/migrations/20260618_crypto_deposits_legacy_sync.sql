-- Sync legacy NOT NULL columns (address_generated, amount_usd) with canonical NOWPayments fields.
-- Prevents insert failures when app writes deposit_address / amount_usdt only.

CREATE OR REPLACE FUNCTION public.crypto_deposits_legacy_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deposit_address IS NOT NULL AND (NEW.address_generated IS NULL OR NEW.address_generated = '') THEN
    NEW.address_generated := NEW.deposit_address;
  ELSIF NEW.address_generated IS NOT NULL AND (NEW.deposit_address IS NULL OR NEW.deposit_address = '') THEN
    NEW.deposit_address := NEW.address_generated;
  END IF;

  IF NEW.amount_usdt IS NOT NULL AND NEW.amount_usd IS NULL THEN
    NEW.amount_usd := NEW.amount_usdt;
  ELSIF NEW.amount_usd IS NOT NULL AND NEW.amount_usdt IS NULL THEN
    NEW.amount_usdt := NEW.amount_usd;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crypto_deposits_legacy_sync_trigger ON public.crypto_deposits;

CREATE TRIGGER crypto_deposits_legacy_sync_trigger
  BEFORE INSERT OR UPDATE ON public.crypto_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.crypto_deposits_legacy_sync();
