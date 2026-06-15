# NOWPayments Setup — ForgeGuard AI

Operator checklist for **receiving** customer crypto payments and **withdrawing** to your wallet.  
Production IPN URL: `https://www.forgeguard-ai.com/api/webhooks/nowpayments`

Do **not** mark payments green until launch-check shows `crypto.configured: true`.

---

## 1. Receiving payments (customers → ForgeGuard)

### 1.1 Vercel environment variables

Set in **Vercel → forgeguard-ai → Settings → Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|----------|----------|-------|
| `NOWPAYMENTS_API_KEY` | Yes | Dashboard → Store Settings → API keys |
| `NOWPAYMENTS_IPN_SECRET` | Yes | Dashboard → Store Settings → IPN secret |
| `SOVEREIGN_CRYPTO_WALLET` | Optional | Static USDT fallback if API wallet lookup fails |

**Verify after save + redeploy:**
```bash
curl -s https://www.forgeguard-ai.com/api/debug/launch-check | jq .checks.crypto
```
Expected when configured:
```json
{ "configured": true, "nowpayments": true, "ipnSecret": true, "sovereignWallet": false }
```

### 1.2 NOWPayments dashboard — IPN callback

1. Log in to [NOWPayments](https://account.nowpayments.io/)
2. **Store Settings → Instant payment notifications**
3. IPN callback URL: `https://www.forgeguard-ai.com/api/webhooks/nowpayments`
4. Copy **IPN secret** → paste into Vercel `NOWPAYMENTS_IPN_SECRET`
5. Enable IPN for payment status changes

**Screenshot paths (save under `CITADEL_LAUNCH_VAULT/screenshots/`):**
- `nowpayments-ipn-url.png` — IPN URL field
- `nowpayments-api-key.png` — API key (redact key in commit)

### 1.3 Cloudflare — allow NOWPayments IPN sources

When `forgeguard-ai.com` is proxied through Cloudflare, allowlist these **source IPs** for POST `/api/webhooks/nowpayments`:

| IP | Region |
|----|--------|
| `51.89.194.21` | NOWPayments |
| `51.75.77.69` | NOWPayments |
| `138.201.172.58` | NOWPayments |
| `65.21.158.36` | NOWPayments |

**WAF rule (recommended):**
- If URI Path equals `/api/webhooks/nowpayments` AND IP in {above list} → **Allow**
- Do **not** block POST to this path globally

**No Vercel “server IP” needed** — webhooks are inbound to Vercel.

### 1.4 Smoke test — $10 payment

1. Deploy with env vars set
2. Dashboard → Billing → Sovereign Vault → start crypto checkout (~$10)
3. Complete payment in NOWPayments sandbox or live (per your account mode)
4. Confirm IPN in Vercel logs: filter `nowpayments`
5. Confirm row in Supabase:
```sql
SELECT id, status, deposit_type, credits_granted, created_at
  FROM crypto_deposits ORDER BY created_at DESC LIMIT 5;
```

### 1.5 curl — IPN endpoint reachability

```bash
# Should NOT return 429 from WAF (may return 401 without valid signature)
curl -sI -X POST https://www.forgeguard-ai.com/api/webhooks/nowpayments
```

```bash
# Launch-check (no auth)
curl -s https://www.forgeguard-ai.com/api/debug/launch-check
```

---

## 2. Withdrawing to your wallet ($500–$1k payouts)

This is **operator home/office IP**, not Vercel or Railway hosting IP.

### 2.1 Whitelist payout source IP

1. Visit [whatismyip.com](https://whatismyip.com) from the machine/browser you use for NOWPayments dashboard withdrawals
2. **NOWPayments Dashboard → Settings → Payments → IP addresses**
3. Add **IPv4 and IPv6** from step 1
4. Repeat if you withdraw from office vs home

### 2.2 Mass payouts wallet whitelist

1. **Dashboard → Mass Payouts → Wallets**
2. Add your destination USDT/TRX (or chosen) wallet
3. Confirm email/2FA if prompted

### 2.3 Payout smoke test

1. Small test withdrawal ($5–$10) before $500–$1k batch
2. Confirm tx hash in NOWPayments payout history

---

## 3. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `crypto.configured: false` | Missing Vercel env | Set API key + IPN secret, redeploy |
| IPN 401 | Wrong `NOWPAYMENTS_IPN_SECRET` | Re-copy from dashboard |
| IPN never arrives | Cloudflare WAF block | Allowlist NOWPayments IPs; exclude webhook from Bot Fight |
| Checkout 503 | API key invalid | Regenerate key in NOWPayments |
| Payout blocked | IP not whitelisted | Add operator IP in Payments settings |

---

## 4. Related docs

- `ENV_MATRIX.md` — full env reference
- `CITADEL_LAUNCH_VAULT/MANUAL_TASKS.md` — Cloudflare DNS + WAF
- `CITADEL_LAUNCH_VAULT/LAUNCH_STATUS_REPORT.md` — live verification evidence
