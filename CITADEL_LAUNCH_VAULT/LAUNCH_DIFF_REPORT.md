# LAUNCH_DIFF_REPORT — Live DB vs Repo (2026-06-13)

**Supabase project:** `nlginrukltrwpkyujzzx` (ForgeGuard-ai)  
**Verified via:** Supabase MCP `list_migrations`, `execute_sql`  
**Not applied via MCP** — operator must run `LAUNCH_ALL.sql` after review.

---

## Migration history gap

| Source | Count | Notes |
|--------|-------|-------|
| Live `supabase_migrations.schema_migrations` | **8** | Genesis-era only (through `genesis30_mission_messages`) |
| Local `supabase/migrations/*.sql` | **47** | Includes crypto, bounty, security repairs, sprint migrations |
| Merged in `LAUNCH_ALL.sql` | **47 + api_keys + scheduled_scans + verify** | ~180 KB idempotent script |

### Live migrations (applied)

1. `20260423005843` fix_profiles_rls_recursion  
2. `20260423010035` harden_admin_profile_policy  
3. `20260423164209` harden_function_search_paths  
4. `20260423174353` create_scans_and_scan_logs  
5. `20260523225355` genesis30_reconcile  
6. `20260523225413` genesis30_rpcs  
7. `20260523225727` genesis30_profile_cols  
8. `20260523230130` genesis30_mission_messages  

### Critical local migrations NOT in live history (39+)

Includes but not limited to:

- `20260615_crypto_deposits.sql` — canonical crypto_deposits + trigger  
- `20260616_crypto_deposit_type_fix.sql` — split subscription vs credit_pack grants  
- `20260529_rpc_service_role_only.sql`, `20260530_security_advisor_repair.sql`  
- Bounty, wallet, scheduled scans, API keys, Aegis, Ghost Protocol, etc.

---

## `crypto_deposits` schema mismatch (P0)

| Expected (repo / app code) | Live DB (verified) |
|----------------------------|-------------------|
| `plan_name`, `plan_id`, `amount_usdt`, `deposit_address`, `pay_currency`, `payment_id` | **Missing** |
| `credits_granted`, `confirmed_at`, `updated_at`, `credit_amount` | **Missing** |
| `deposit_type` (`subscription` \| `credit_pack`) | **Present** (manual patch) |
| Legacy columns | `address_generated`, `amount_usd`, `currency_type`, `tx_hash` |

**Impact:** `generateDepositAddress` inserts will fail or IPN webhook cannot match `payment_id`.  
**Trigger:** `handle_crypto_deposit_confirmed` — **NOT FOUND** on live DB.  
**Triggers on table:** **NONE** (confirmed deposits do not grant subscription or wallet).

---

## Other live checks (2026-06-13)

| Object | Live status |
|--------|-------------|
| `scans.failure_reason` | Present (text) |
| `scans.target_diagnostic_logs` | Present (text) |
| `scan_reports` table | Present |
| `increment_wallet` RPC | Assumed present (genesis reconcile); verify after LAUNCH_ALL |
| `my_scan_quota` view | Not verified — included in LAUNCH_ALL tail |
| `user_api_keys` | Not verified — run `sql/api_keys.sql` section |

### Postgres log signals (last 24h)

- Manual SQL adding `deposit_type` to `crypto_deposits`  
- **ERROR:** `profiles_subscription_tier_check` rejected `subscription_tier = 'sovereign'` until constraint expanded  

---

## Security advisors (Supabase MCP)

- WARN: mutable `search_path` on SECURITY DEFINER RPCs  
- WARN: permissive RLS policies on several tables  
- WARN: anon/authenticated EXECUTE on sensitive functions (partially addressed in migrations)  
- WARN: leaked password protection disabled (enable in Auth dashboard)  

---

## Recommended operator action

1. **Backup** Supabase project (Dashboard → Database → Backups).  
2. Run **`CITADEL_LAUNCH_VAULT/LAUNCH_ALL.sql`** once in SQL Editor.  
3. Re-run verification block at end of script (from `sql/verify-live-schema.sql`).  
4. Confirm:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'crypto_deposits' AND column_name IN ('payment_id','plan_id','amount_usdt');
   SELECT tgname FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'crypto_deposits' AND NOT t.tgisinternal;
   ```
5. **Migrate legacy rows** if any exist in old column names (manual one-off — not automated).

---

## Production HTTP (curl verified)

| Endpoint | Result |
|----------|--------|
| `GET /api/health/engine` | **200** — healthy, ~158ms latency |
| `GET /api/debug/launch-check` | **404** before this deploy — restored in repo (no Stripe, no localhost ingest) |
