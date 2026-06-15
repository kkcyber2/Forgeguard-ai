# CITADEL LAUNCH VAULT — Manual Deployment Tasks

> **Role:** Chief Release Officer checklist for ForgeGuard Admin Command Center  
> **Repo:** `forgeguard-ai`  
> **Constraint:** Do not push to Git until this vault is populated and `npm run build` passes locally.

---

## Pre-flight

1. **Confirm Supabase project** — Open [Supabase Dashboard](https://supabase.com/dashboard) for your live ForgeGuard project (`nlginrukltrwpkyujzzx`).
2. **One-shot schema bootstrap (recommended):**
   ```text
   Run ONCE in Supabase SQL Editor:
   CITADEL_LAUNCH_VAULT/LAUNCH_ALL.sql
   ```
   See `CITADEL_LAUNCH_VAULT/LAUNCH_DIFF_REPORT.md` for live-vs-repo gaps before running.
3. **Compare migrations** — Local migrations live in `supabase/migrations/`. Live DB currently tracks only 8 genesis migrations; most schema was never applied via CLI.
3. **Service role key** — Ensure `.env.local` has:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for admin pages, storage download, wallet RPC)

---

## 1. Database — Run LAUNCH_ALL.sql (primary)

**⚠️ Do not apply via MCP/CI without review. Run manually in Supabase SQL Editor.**

**File:** `CITADEL_LAUNCH_VAULT/LAUNCH_ALL.sql`

Merges all 47 local migrations + `sql/api_keys.sql` + `sql/scheduled_scans.sql` + verification SELECTs from `sql/verify-live-schema.sql`. Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`).

**Alternative (legacy):** `CITADEL_LAUNCH_VAULT/RUN_IN_SUPABASE.sql` or `master-schema.sql` — partial; prefer `LAUNCH_ALL.sql` for launch.

**Pre-read:** `CITADEL_LAUNCH_VAULT/LAUNCH_DIFF_REPORT.md`

This adds:
| Feature | Schema change |
|---------|---------------|
| Bazaar Certified badge | `bazaar_scripts.is_certified` |
| Mission escrow ledger | `platform_transactions.tx_type` includes `escrow_hold` |
| Escrow queries | Index on `bounty_escrow.mission_id`, held status |
| Verification triage | Profile audit columns + clearance `pending` tier |
| Wallet debit on assign | `increment_wallet()` RPC with `balance_usd` |
| Live map heartbeat | Realtime publication for `scan_logs`, `scans` |
| ID document OCR path | `verification-docs` storage bucket + RLS |
| Ghost Protocol | `profiles.is_ghost_active`, `profiles.subscription_tier` |
| Stronghold OTP + wallet realtime | `verification_otps.code_hash`, `user_wallets` in Realtime publication |
| Section 12 legacy repair | `phone_number`→`phone`, `consumed`, `otp_logs` columns, `REPLICA IDENTITY FULL` on wallets |
| Section 13 Aegis telemetry | `attack_logs` table (RLS on, service-role inserts only) |

**Verify:**
```sql
SELECT is_certified FROM bazaar_scripts LIMIT 1;
SELECT tx_type FROM platform_transactions WHERE tx_type = 'escrow_hold' LIMIT 1;
SELECT proname FROM pg_proc WHERE proname = 'increment_wallet';
SELECT id FROM storage.buckets WHERE id = 'verification-docs';
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'profiles' AND column_name IN ('is_ghost_active','subscription_tier');
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'verification_otps' AND column_name = 'code_hash';
SELECT tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND tablename = 'user_wallets';
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'verification_otps'
   AND column_name IN ('phone', 'code_hash', 'consumed');
SELECT relreplident FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'user_wallets';
SELECT to_regclass('public.attack_logs');
SELECT relrowsecurity FROM pg_class WHERE relname = 'attack_logs';
```

---

## 1b. API Keys table (Settings / CI-CD)

If Vercel logs show `PGRST205` / `Could not find the table 'public.user_api_keys'`:

**File:** `sql/api_keys.sql`

In **Supabase → SQL Editor**, paste and run the full script. This creates `user_api_keys`, indexes, and RLS policies for the Settings → API Keys section and `/api/v1/scans` bearer auth.

**Verify:**
```sql
SELECT to_regclass('public.user_api_keys');
```

---

## 2. Environment Variables

Add to **Vercel / `.env.local`**:

| Variable | Required for | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_APP_URL` | SEO, OG, canonical | `https://www.forgeguard-ai.com` |
| `ALLOWED_ORIGINS` | API CORS | `https://www.forgeguard-ai.com` |
| `SOVEREIGN_OPERATOR_EMAIL` | Admin + Dev persona gate | Default `ksk805763@gmail.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Aegis attack_logs middleware writes | Server-only — never `NEXT_PUBLIC_` |
| `OPENROUTER_API_KEY` | AI Verification Triage (`/admin/verification`) | DeepSeek-R1 via OpenRouter. Without it, heuristic fallback runs (lower confidence). |
| `TWILIO_ACCOUNT_SID` | Legacy SMS OTP | **Deprecated for clearance** — optional; `TWILIO_SIMULATION_MODE` for dev |
| `TWILIO_AUTH_TOKEN` | Legacy SMS OTP | Deprecated for clearance |
| `TWILIO_PHONE_NUMBER` | Legacy SMS OTP | Deprecated for clearance |

### 2a. Payments — Vercel production (P0 launch blocker)

Set on **Vercel → forgeguard-ai → Settings → Environment Variables → Production**, then **Redeploy**:

| Variable | Required | Notes |
|----------|----------|-------|
| `NOWPAYMENTS_API_KEY` | **Yes** (or sovereign fallback) | Enables crypto checkout; sets `launch-check` `crypto.configured` |
| `NOWPAYMENTS_IPN_SECRET` | **Yes** for live IPN | HMAC verification on `POST /api/webhooks/nowpayments` |
| `SOVEREIGN_CRYPTO_WALLET` | Optional fallback | Alternative to NOWPayments API for manual deposit addresses |
| `WAR_MACHINE_URL` | Recommended | War Machine microservice URL (`launch-check` `warMachine`) |

**Verify after redeploy:**

```bash
curl -s https://www.forgeguard-ai.com/api/debug/launch-check
```

Expect: `"crypto": { "configured": true, "nowpayments": true, "ipnSecret": true }` (or `sovereignWallet: true`).

Then run **§4.5 Sovereign Vault — Crypto checkout smoke test** (subscription + credit_pack IPN).

**Operator cannot skip:** Payments stay **Red** in `LAUNCH_STATUS_REPORT.md` until `crypto.configured: true` on production launch-check.

**Verification go-live checklist:**

1. **Schema** — Run in Supabase SQL Editor:
   ```sql
   SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'ale_usd';
   SELECT id FROM storage.buckets WHERE id = 'verification-docs';
   SELECT to_regclass('public.verification_otps'), to_regclass('public.otp_logs');
   ```
   Expected: `ale_usd` on `scan_reports` (not required on `scans`); `verification-docs` bucket exists.

2. **Security migrations** — Apply in order:
   - `supabase/migrations/20260529_rpc_service_role_only.sql`
   - `supabase/migrations/20260530_security_advisor_repair.sql`
   - `supabase/migrations/20260618_security_invoker_views.sql` — clears 4 `security_definer_view` ERROR lints (`my_scan_quota`, `profiles_with_rank`, `intel_messages_with_profile`, `war_machine_leads`)

3. **Twilio (legacy SMS OTP)** — No longer required for Tactical clearance. Hacker identity uses **Settings → Face liveness** (multi-pose webcam). Twilio vars optional for legacy `sendOTP`/`verifyOTP` only; set `TWILIO_SIMULATION_MODE=true` in dev.

3b. **Face liveness migration** — Apply `supabase/migrations/20260619_face_liveness.sql`:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name IN ('face_liveness_verified','face_liveness_at','face_liveness_pose_count');
   ```
   Storage path: `verification-docs/{userId}/liveness/{pose}-{timestamp}.jpg`

4. **ID / webcam upload** — Enterprise sovereign path unchanged:
   - Confirm `SUPABASE_SERVICE_ROLE_KEY` on Vercel
   - User uploads in **Settings → Identity proofing**
   - Admin reviews at **`/admin/verification`** (needs `profiles.sovereign_pending = true`)

5. **Auth hardening (manual — P1 launch)** — Supabase Dashboard → **Authentication → Settings**:
   - **Leaked password protection:** Enable HaveIBeenPwned integration. Security advisor reports `auth_leaked_password_protection` WARN while disabled — re-check advisors after enable.
   - **MFA:** Enable for Sovereign operator and all `profiles.role = 'admin'` accounts (Authenticator app or WebAuthn).
   - Require MFA enrollment before granting admin clearance in production.

**OpenRouter setup:**
1. Create key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Ensure billing/credits enabled for `deepseek/deepseek-r1`
3. Redeploy after adding env vars

---

## 2b. Cloudflare — DNS + WAF (operator)

Proxy **forgeguard-ai.com** and **www.forgeguard-ai.com** through Cloudflare (orange cloud).

| Rule | Action |
|------|--------|
| Rate limit `/api/*` | e.g. 120 req/min per IP (adjust per traffic) |
| Rate limit `/auth/*` | e.g. 30 req/min per IP |
| Allow NOWPayments IPN | Source IPs: `51.89.194.21`, `51.75.77.69`, `138.201.172.58`, `65.21.158.36` → **Allow** POST `/api/webhooks/nowpayments` |
| Do NOT block | `POST /api/webhooks/nowpayments`, `GET /api/health`, `GET /api/health/engine`, `GET /api/debug/launch-check` |
| Audit bots | Keep Googlebot + Chrome-Lighthouse allowed on marketing `/` (middleware allowlist — do not WAF-block Lighthouse UA) |
| Bot Fight Mode (optional) | Exclude webhook + health paths |

Full payments checklist: `CITADEL_LAUNCH_VAULT/NOWPAYMENTS_SETUP.md`

---

## 3. Admin Role Assignment

Admin pages gate on `profiles.role = 'admin'` **and** sovereign operator email (via `requireAdminProfile()`).

**Promote your operator account (sovereign operator only):**
```sql
UPDATE public.profiles
   SET role = 'admin',
       is_admin = true,
       clearance_tier = 'sovereign'
 WHERE email = 'ksk805763@gmail.com';
```

---

## 4. Feature Smoke Tests

### 4.5 Sovereign Vault — Crypto checkout smoke test

**Prerequisite:** `LAUNCH_ALL.sql` applied (see §1). Without it, `generateDepositAddress` inserts fail on missing columns.

**Subscription path (`deposit_type = subscription`):**

1. Dashboard → Billing → select Startup or Enterprise → Sovereign Vault modal.
2. Complete NOWPayments deposit; wait for IPN (`/api/webhooks/nowpayments`).
3. Confirm `subscriptions.plan` active; wallet unchanged except overage debits elsewhere.

**Credit pack path (`deposit_type = credit_pack`):**

1. Billing → credit pack → Sovereign Vault.
2. After IPN: `user_wallets.balance_usd` increases via `increment_wallet`; subscription tier unchanged.

**Verify in SQL:**

```sql
SELECT id, deposit_type, status, credits_granted, plan_id, credit_amount
  FROM crypto_deposits ORDER BY created_at DESC LIMIT 5;
```

---

### 4.1 AI Verification Triage — `/admin/verification`

1. Sign in as admin → navigate to **Verification** in admin nav.
2. Ensure at least one user has `sovereign_pending = true` or `clearance_tier = 'pending'`.
3. User must have uploaded ID to `verification-docs` bucket (`profiles.identity_document_path` set).
4. Click **AI audit** on a row:
   - **Confidence Meter** fills (Acid Green ≥80%, Nuclear Red <80%)
   - **AI Audit Summary** populates
   - Mismatched identities highlight row in Nuclear Red
5. Click **Grant access** to promote to Sovereign clearance.

**Seed test user (optional):**
```sql
UPDATE public.profiles
   SET sovereign_pending = true,
       clearance_tier = 'pending',
       identity_document_path = 'USER_UUID/sample-id.jpg',
       full_name = 'Jane Sovereign'
 WHERE email = 'test@example.com';
```

### 4.2 Bazaar Governance — `/admin/bazaar`

1. Submit a script from dashboard Bazaar (status `pending` / `flagged`).
2. Admin → **Bazaar Triage** → **Inspect** on pending script.
3. Confirm read-only monospaced **Source Code** viewer loads.
4. Click **VERIFY & PUBLISH**:
   - `audit_verdict = 'cleared'`
   - `is_published = true`
   - `is_certified = true` (ForgeGuard Certified badge)
5. Script appears in public Bazaar marketplace.

### 4.3 Mission Escrow & Financial Ledger

**Escrow hold (client wallet → bounty_escrow):**
1. Client creates mission with `budget_credits > 0`.
2. Client wallet must have sufficient `user_wallets.balance_usd`.
3. Client accepts a hacker proposal → credits debit from client wallet, escrow row created with `status = 'held'`.
4. Check ledger entry: `platform_transactions.tx_type = 'escrow_hold'`.

**Release (escrow → hacker wallet):**
1. Admin → **Financial Ledger** (`/admin/ledger`) or **Bounty Escrow** (`/admin/bounties`).
2. Click **RELEASE FUNDS** on held row.
3. Hacker `user_wallets.balance_usd` increases atomically via `increment_wallet`.
4. Escrow status → `released`; ledger shows `bounty_release`.

**Top up test wallet (dev only):**
```sql
SELECT public.increment_wallet(
  (SELECT id FROM auth.users WHERE email = 'client@example.com'),
  500.00
);
```

### 4.4 Global Map Heartbeat — `/admin`

1. Start or queue scans (`scans.status IN ('queued','probing')`).
2. Admin overview map should pulse PoP nodes mapped from `target_url` (29 global nodes).
3. If URL has no geo signal, node is hashed/randomized among the 29 nodes.
4. New `scan_logs` findings (type=`finding`) trigger additional realtime pulses.

**Enable Realtime (if map stays idle):**
- Supabase → Database → Replication → ensure `scan_logs` and `scans` are enabled.

---

## 5. Storage Bucket — verification-docs

If bucket creation in SQL fails (permissions), create manually:

1. **Storage → New bucket** → Name: `verification-docs`, **Private**
2. Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
3. Max file size: 10 MB
4. RLS policies (see `master-schema.sql` section 7)

Upload path convention: `{user_id}/{filename}`

---

## 6. Build & Deploy

Local verification (must pass before Git push):

```bash
cd forgeguard-ai
npm run typecheck
npm run build
```

Deploy to Vercel (or your host) with `runtime = nodejs` on all admin routes (already set in codebase).

---

## 7. Known Stubs Resolved (Audit Log)

| Area | Was | Now |
|------|-----|-----|
| `/admin/verification` | Grant-only queue | DeepSeek-R1 audit + confidence meter + mismatch highlight |
| `/admin/bazaar` | Wrong column names (`price_credits`) | Uses `price_usd`, `audit_risk_score`, `is_certified` |
| Mission assign | Escrow row only | Debits client wallet + `escrow_hold` ledger entry |
| `/admin/ledger` | Missing | Full financial ledger + release funds |
| LiveWorldMap | Random decorative pulses | Wired to last 5 active scans + Realtime |
| `threats/test.txt` | Stray junk file | Deleted |

---

## 8. Rollback Notes

If `escrow_hold` constraint fails on existing bad rows:
```sql
UPDATE platform_transactions SET tx_type = 'refund' WHERE tx_type NOT IN (
  'bazaar_purchase','bounty_release','escrow_hold','top_up','refund'
);
```
Then re-run `master-schema.sql`.

---

## 9. Post-Launch Monitoring

- **Admin → System health** — scan worker queue depth
- **Admin → Financial Ledger** — held escrow total vs wallet circulation
- **Supabase Logs** — watch for `increment_wallet` failures or storage 403 on verification-docs
- **OpenRouter dashboard** — DeepSeek-R1 usage on verification triage

---

*Citadel sealed. Execute in order. No Git push until build green.*
