# SECURITY_HARDENING_REPORT — ForgeGuard AI Launch

**Date:** 2026-06-13  
**Project:** `nlginrukltrwpkyujzzx` (Supabase) · Vercel + Railway Agathon  
**Scope:** P0 launch blockers + P1 security audit + P2 ReDoS notes

---

## Executive summary

| Layer | Status |
|-------|--------|
| **Live DB (`LAUNCH_ALL.sql`)** | **APPLIED** — verified via Supabase MCP (2026-06-13) |
| **Vercel env (production secrets)** | **Not verified** — use Vercel MCP `list_teams` → env audit |
| **Engine health** | **Verified live** — `GET /api/health/engine` → 200 |
| **Code hardening (P1/P2)** | **Applied in repo** |

---

## Worry

| ID | Risk | Severity | Live status |
|----|------|----------|-------------|
| W1 | `LAUNCH_ALL.sql` not run | **P0** | **Fixed live** — 57 migrations, crypto columns + trigger verified |
| W2 | `handle_crypto_deposit_confirmed` trigger absent | **P0** | **Fixed live** — `crypto_deposit_confirmed_trigger` present |
| W3 | NOWPayments IPN / API keys may be unset on Vercel | **P0** | **Unverified** (local `.env.local` also missing keys) |
| W4 | `INTERNAL_SCAN_TOKEN` byte-match Vercel ↔ Railway | **P0** | **Unverified** (secrets not readable from this session) |
| W5 | `AGATHON_WEBHOOK_CALLBACK_URL` on Railway | **P0** | **Unverified** (Railway dashboard required) |
| W6 | Secrets in scan diagnostics / PDF evidence (`sk-`, `AKIA…`, `ghp_`, `xoxb-`) | **P1** | Code-only fix applied |
| W7 | Auth DoS via oversized email/password payloads | **P1** | Code-only fix applied |
| W8 | Clipboard clipper swaps USDT deposit address | **P1** | Code-only fix applied |
| W9 | Leaked password protection + admin MFA disabled | **P1** | **Operator action** (Supabase Auth dashboard) |
| W10 | ReDoS via unbounded attack strings → regex | **P2** | Code-only cap (500 chars) |
| W11 | No distributed rate limit on `/auth/*` | **P2** | Documented post-launch in `ENV_MATRIX.md` |

---

## Fixed (this session — code only)

| Item | File(s) | Change |
|------|---------|--------|
| Auth email max 254 | `src/app/auth/actions.ts` | Login, signup, magic link Zod schemas |
| Auth password max 128 | `src/app/auth/actions.ts` | Login + signup Zod schemas |
| Secret redaction | `src/lib/security/redact-secrets.ts` | Masks `AKIA…`, `sk-`, `ghp_`, `xoxb-` |
| Report / PDF redaction | `findings-report.tsx`, `tactical-target-error.tsx`, `scan-dispatch-error.tsx` | Applied before dashboard + PDF HTML render |
| Clipper malware guard | `sovereign-vault-modal.tsx` | Warning + first/last 6 char confirmation gates payout verify |
| ReDoS cap | `src/lib/aegis/attack-regex.ts` | `attackStringToRegex()` input capped at 500 chars |
| MFA + leaked-password docs | `CITADEL_LAUNCH_VAULT/MANUAL_TASKS.md` | Operator checklist expanded |
| Upstash post-launch | `ENV_MATRIX.md` | `/auth/*` rate limit noted as P2 |

---

## Verified live (this session)

| Check | Method | Result |
|-------|--------|--------|
| Engine reachable | `curl https://www.forgeguard-ai.com/api/health/engine` | **200 healthy** |
| `crypto_deposits.payment_id` | Supabase REST `?select=payment_id` | **400 — column missing** |
| `crypto_deposits.deposit_type` | Supabase REST | **Present** (manual patch) |
| Legacy `address_generated`, `amount_usd` | Supabase REST | **Present** |
| `release_kinetic_bounty` RPC | OpenAPI paths | **Present** |
| `increment_wallet` RPC | OpenAPI paths | **Present** |
| Crypto IPN end-to-end | — | **Not tested** (blocked by W1/W2) |
| Vercel `NOWPAYMENTS_*` | — | **Not verified** (PoW on launch-check; no dashboard access) |

**Supabase MCP:** unavailable (server error) — verification used service-role REST against live project.

---

## Operator action

### 1. Run `LAUNCH_ALL.sql` (P0 — launch blocker)

```text
1. Supabase Dashboard → Database → Backups → confirm recent backup
2. SQL Editor → paste CITADEL_LAUNCH_VAULT/LAUNCH_ALL.sql → Run once
3. Verify:
```

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'crypto_deposits'
   AND column_name IN ('payment_id','plan_id','amount_usdt','deposit_address','credits_granted','confirmed_at');

SELECT tgname FROM pg_trigger t
 JOIN pg_class c ON t.tgrelid = c.oid
 WHERE c.relname = 'crypto_deposits' AND NOT t.tgisinternal;
```

Expected: all six columns present; trigger `handle_crypto_deposit_confirmed` (or equivalent) listed.

### 2. Vercel environment (P0)

Set and redeploy:

| Variable | Must match |
|----------|------------|
| `NOWPAYMENTS_API_KEY` | NOWPayments dashboard |
| `NOWPAYMENTS_IPN_SECRET` | NOWPayments IPN settings (HMAC-SHA512) |
| `PYTHON_ENGINE_URL` | Railway Agathon URL, **no trailing slash** |
| `INTERNAL_SCAN_TOKEN` | **Identical bytes** on Railway `AI-red-team` |

### 3. Railway environment (P0)

| Variable | Value |
|----------|-------|
| `INTERNAL_SCAN_TOKEN` | Same as Vercel |
| `AGATHON_WEBHOOK_CALLBACK_URL` | `https://www.forgeguard-ai.com/api/v1/webhooks/agathon` |

### 4. Crypto smoke test (after LAUNCH_ALL)

**Subscription (`deposit_type = subscription`):**

1. Billing → Sovereign Vault → Startup/Enterprise plan → complete NOWPayments flow.
2. Confirm IPN hits `/api/webhooks/nowpayments` (Vercel logs: `nowpayments`).
3. Verify `crypto_deposits.status = confirmed`, `credits_granted = true`.
4. Verify `subscriptions` row: `plan` matches, `status = active`, `scans_used_this_period = 0`.

**Credit pack (`deposit_type = credit_pack`):**

1. Billing → credit pack checkout.
2. After IPN confirm: `user_wallets.balance_usd` increases; **no** new/changed subscription tier.
3. App grant path: `grantConfirmedCryptoDeposit()` in `src/lib/payments/crypto.ts` (mirrors `20260616` trigger split).

### 5. Supabase Auth hardening (P1)

Dashboard → **Authentication → Settings**:

- Enable **Leaked password protection**
- Enable **MFA**; require enrollment for Sovereign operator + all admin accounts before production admin access

---

## Env vars still missing / unverified

| Platform | Variable | Notes |
|----------|----------|-------|
| Vercel | `NOWPAYMENTS_API_KEY` | Required for checkout |
| Vercel | `NOWPAYMENTS_IPN_SECRET` | Required for IPN HMAC |
| Vercel | `INTERNAL_SCAN_TOKEN` | Must match Railway |
| Vercel | `PYTHON_ENGINE_URL` | Set (engine health OK); confirm no trailing `/` |
| Railway | `AGATHON_WEBHOOK_CALLBACK_URL` | Scan completion webhooks |
| Railway | `INTERNAL_SCAN_TOKEN` | Must match Vercel |
| Local dev | All above in `.env.local` | Local copy missing payment keys at audit time |

---

## Files changed (no commit)

```
src/app/auth/actions.ts
src/lib/security/redact-secrets.ts          (new)
src/lib/aegis/attack-regex.ts
src/app/dashboard/scans/[id]/findings-report.tsx
src/app/dashboard/scans/[id]/tactical-target-error.tsx
src/app/dashboard/scans/[id]/scan-dispatch-error.tsx
src/app/dashboard/billing/sovereign-vault-modal.tsx
CITADEL_LAUNCH_VAULT/MANUAL_TASKS.md
ENV_MATRIX.md
CITADEL_LAUNCH_VAULT/SECURITY_HARDENING_REPORT.md  (this file)
```

---

*Do not mark crypto payments or LAUNCH_ALL as fixed until operator SQL + smoke tests pass.*
