# CITADEL LAUNCH VAULT — Manual Deployment Tasks

> **Role:** Chief Release Officer checklist for ForgeGuard Admin Command Center  
> **Repo:** `forgeguard-ai`  
> **Constraint:** Do not push to Git until this vault is populated and `npm run build` passes locally.

---

## Pre-flight

1. **Confirm Supabase project** — Open [Supabase Dashboard](https://supabase.com/dashboard) for your live ForgeGuard project.
2. **Compare migrations** — Local migrations live in `supabase/migrations/`. If live DB was patched manually, run the reconciliation file first:
   ```bash
   # In Supabase SQL Editor, run in order if not already applied:
   # 1. supabase/migrations/20260524_genesis30_reconcile.sql
   # 2. CITADEL_LAUNCH_VAULT/master-schema.sql
   ```
3. **Service role key** — Ensure `.env.local` has:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for admin pages, storage download, wallet RPC)

---

## 1. Database — Run Master Schema

**⚠️ Cursor is NOT connected to your Supabase project. You must run SQL manually.**

**Recommended — one file, everything included:**

**File:** `CITADEL_LAUNCH_VAULT/RUN_IN_SUPABASE.sql`

In **Supabase → SQL Editor → New query**, paste the **full** contents of `RUN_IN_SUPABASE.sql` and execute once.

This single script includes Admin Command Center schema, Persona Switcher, Iron Wall verification repair, Ghost Protocol, and **Stronghold completion** (`verification_otps`, `code_hash`, wallet Realtime).

**Alternative (legacy):** `CITADEL_LAUNCH_VAULT/master-schema.sql` — same content, kept in sync; prefer `RUN_IN_SUPABASE.sql` for new deploys.

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
```

---

## 2. Environment Variables

Add to **Vercel / `.env.local`**:

| Variable | Required for | Notes |
|----------|--------------|-------|
| `OPENROUTER_API_KEY` | AI Verification Triage (`/admin/verification`) | DeepSeek-R1 via OpenRouter. Without it, heuristic fallback runs (lower confidence). |
| `NEXT_PUBLIC_APP_URL` | OpenRouter referer header | e.g. `https://your-domain.com` |
| `TWILIO_ACCOUNT_SID` | User OTP flow (Stronghold) | Optional for admin triage |
| `TWILIO_AUTH_TOKEN` | User OTP flow | Optional for admin triage |
| `TWILIO_PHONE_NUMBER` | User OTP flow | Optional for admin triage |

**OpenRouter setup:**
1. Create key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Ensure billing/credits enabled for `deepseek/deepseek-r1`
3. Redeploy after adding env vars

---

## 3. Admin Role Assignment

Admin pages gate on `profiles.role = 'admin'` (via `requireAdminProfile()`).

**Promote your operator account:**
```sql
UPDATE public.profiles
   SET role = 'admin',
       is_admin = true
 WHERE email = 'YOUR_ADMIN_EMAIL@domain.com';
```

---

## 4. Feature Smoke Tests

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
