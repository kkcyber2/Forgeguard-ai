-- Restrict wallet / bazaar RPCs to service_role (server-side only)
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_bazaar_script(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_purchase(uuid, numeric) TO service_role;
