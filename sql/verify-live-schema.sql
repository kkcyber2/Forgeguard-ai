-- Live schema verification (Dashboard Crash Recovery)
-- Run in Supabase SQL Editor for project nlginrukltrwpkyujzzx

SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'ale_usd'
ORDER BY table_name;

SELECT column_name, table_name
FROM information_schema.columns
WHERE table_name IN ('profiles', 'user_wallets', 'subscriptions', 'bazaar_purchases')
  AND column_name IN ('hacker_rank', 'balance_usd', 'is_frozen', 'plan', 'status', 'author_id')
ORDER BY table_name, column_name;

SELECT p.proname, r.rolname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public'
  AND p.proname IN ('increment_wallet', 'purchase_bazaar_script', 'increment_purchase')
ORDER BY p.proname, r.rolname;

SELECT id FROM storage.buckets WHERE id = 'verification-docs';

SELECT to_regclass('public.verification_otps') AS verification_otps,
       to_regclass('public.otp_logs') AS otp_logs;
