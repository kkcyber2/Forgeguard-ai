# OPERATOR_SMOKE — Launch checklist (no new scans)

**Purpose:** Manual verification for billing + identity + platform health before marking launch **fully green**.  
**Does not require:** OpenRouter credits, Agathon scan launch, or live red-team runs.

**Supabase:** `nlginrukltrwpkyujzzx` · **Production:** `https://www.forgeguard-ai.com`

---

## Prerequisites

- [ ] Logged in as operator account (not incognito for billing — session required)
- [ ] Supabase SQL editor or MCP access for row verification
- [ ] Vercel dashboard → **forgeguard-ai** → Logs (for IPN)
- [ ] Phone on same network (for mobile liveness) or Chrome DevTools device mode **390×844**

---

## Step 0 — Automated preflight (curl)

Run from any terminal. All should pass before manual UI steps.

> **Windows PowerShell:** use `curl.exe` (native `curl` is aliased to `Invoke-WebRequest`).

### 0.1 Launch-check

```powershell
curl.exe -s https://www.forgeguard-ai.com/api/debug/launch-check
```

**Pass criteria:**

| Field | Expected |
|-------|----------|
| `ok` | `true` |
| `checks.crypto.configured` | `true` |
| `checks.crypto.nowpayments` | `true` |
| `checks.crypto.ipnSecret` | `true` |
| `checks.engineProbe.ok` | `true` |
| `checks.engineProbe.latencyMs` | `< 2000` |
| `checks.envMatrixComplete` | `true` |

**Pretty-print (optional, requires jq):**

```bash
curl -s https://www.forgeguard-ai.com/api/debug/launch-check | jq '{ok, crypto: .checks.crypto, engine: .checks.engineProbe, env: .checks.envMatrixComplete}'
```

### 0.2 Engine health

```powershell
curl.exe -s https://www.forgeguard-ai.com/api/health/engine
```

**Pass criteria:**

| Field | Expected |
|-------|----------|
| HTTP status | `200` |
| `status` | `healthy` (or equivalent healthy payload) |
| Response time | `< 2s` |

### 0.3 NOWPayments webhook reachability (signature not required)

```powershell
curl.exe -sI -X POST https://www.forgeguard-ai.com/api/webhooks/nowpayments
```

**Pass criteria:** Not `5xx`. `401` (invalid signature) or `400` (empty body) is OK — proves route is live.  
**Fail:** `429` from audit IP only; NOWPayments uses their own IPs (see `NOWPAYMENTS_SETUP.md`).

---

## Step 1 — $10 Sovereign Vault crypto checkout

**Goal:** Pending `crypto_deposits` row on checkout open; `confirmed` + wallet/subscription grant after IPN.

### 1.1 Start checkout (credit pack — ~$10)

1. Open **https://www.forgeguard-ai.com/dashboard/billing**
2. Scroll to **Credit Pack · Bazaar** (Starter Pack — **$10 USDT** → 100 Bazaar credits)
3. Click **Open Sovereign Vault**
4. Wait for QR + deposit address (should appear in **< 5s**)

**Pass (immediate):**

- [ ] Modal shows deposit address + QR
- [ ] No red error banner (especially not "Failed to record deposit")
- [ ] Optional: confirm first/last 6 chars of address match displayed address

**Supabase — pending row:**

```sql
SELECT id, user_id, deposit_type, status, amount_usdt, credit_amount,
       payment_id, credits_granted, created_at
FROM crypto_deposits
ORDER BY created_at DESC
LIMIT 3;
```

**Pass:**

| Column | Expected |
|--------|----------|
| `deposit_type` | `credit_pack` |
| `status` | `pending` |
| `amount_usdt` | `10` (or env `CREDIT_PACK_USD`) |
| `credit_amount` | `100` (marketing credits count) |
| `payment_id` | non-null if NOWPayments API succeeded |
| `credits_granted` | `false` |

### 1.2 Complete payment

1. Send **exact USDT amount** shown to the generated address (NOWPayments flow)
2. Wait for on-chain confirmation + NOWPayments IPN (typically 2–15 min)

**Alternative (dev only):** If `REVENUE_SIMULATION_MODE=true` on preview, use simulate button — **not for production sign-off**.

### 1.3 Verify IPN (Vercel logs)

1. Vercel → **forgeguard-ai** → **Logs**
2. Filter: `nowpayments` or path `/api/webhooks/nowpayments`

**Pass:**

- [ ] Log line shows IPN received (no persistent `401 Invalid signature`)
- [ ] No `grant failed` / `500` after valid IPN

### 1.4 Verify Supabase after confirmation

```sql
SELECT id, deposit_type, status, amount_usdt, credits_granted, confirmed_at
FROM crypto_deposits
ORDER BY created_at DESC LIMIT 1;

SELECT user_id, balance_usd FROM user_wallets
WHERE user_id = (SELECT user_id FROM crypto_deposits ORDER BY created_at DESC LIMIT 1);
```

**Pass:**

| Check | Expected |
|-------|----------|
| `crypto_deposits.status` | `confirmed` |
| `crypto_deposits.credits_granted` | `true` |
| `user_wallets.balance_usd` | Increased by **`amount_usdt` ($10)**, not `credit_amount` (100) |

> **P0 fix (2026-06-13):** Trigger + app grant now use `amount_usdt` for credit packs. See `20260625_credit_pack_wallet_grant.sql`.

### 1.5 Subscription path (optional second test)

Repeat with **Startup** or **Sovereign** plan from plan selector → Sovereign Vault.

**Pass:** `deposit_type = subscription`, `subscriptions.plan` active, wallet unchanged (except unrelated debits).

---

## Step 2 — Face liveness on mobile (390×844)

**Goal:** Tactical clearance — 5 poses sealed; gov ID upload shows green **Received**.

### 2.1 Device setup

- **Real phone (recommended):** iOS Safari or Android Chrome, portrait
- **Emulator:** Chrome DevTools → iPhone 14 Pro → **390×844**
- URL: **https://www.forgeguard-ai.com/dashboard/settings**
- Must be **HTTPS** (camera blocked on HTTP)

### 2.2 Face liveness

1. Scroll to **Clearance & Verification** (on mobile, clearance ladder appears **at top**)
2. Tap **Start liveness scan**
3. Allow camera permission
4. Capture all **5 poses:** center → up → down → left → right
5. Tap **Submit liveness**

**Pass:**

- [ ] Video preview fills frame (min ~240px height, no horizontal scroll)
- [ ] Each pose chip turns acid-green when captured
- [ ] After submit: **"Face liveness verified"** with pose count
- [ ] Clearance ladder shows **Face liveness verified** ✓

**Fail signals:**

| Symptom | Action |
|---------|--------|
| "SSL REQUIRED FOR BIOMETRICS" | Use production HTTPS URL |
| Camera permission denied | iOS Settings → Safari → Camera → Allow |
| Storage upload failed | Check `verification-docs` bucket + service role |
| Schema sync error | Apply `20260619_face_liveness.sql` |

### 2.3 Government ID upload

1. Same page → **Government ID** section
2. Tap upload zone → pick PDF/PNG/JPEG from gallery (**≤ 8 MB**)
3. Submit upload

**Pass:**

- [ ] Green **"Received: filename"** (or equivalent success state)
- [ ] Clearance ladder shows **Government ID uploaded** ✓

**Screenshot (optional):** Save to `CITADEL_LAUNCH_VAULT/screenshots/mobile-ux/` per `MOBILE_UX_REPORT.md`.

---

## Step 3 — Sign-off matrix

| Step | Automated? | Pass? | Date | Operator initials |
|------|------------|-------|------|-------------------|
| 0.1 launch-check | curl | ☐ | | |
| 0.2 engine health | curl | ☐ | | |
| 0.3 IPN route live | curl -I | ☐ | | |
| 1 crypto_deposits pending | UI + SQL | ☐ | | |
| 1 IPN + confirmed | Vercel + SQL | ☐ | | |
| 2 face liveness mobile | Phone 390×844 | ☐ | | |
| 2 gov ID upload | Phone/desktop | ☐ | | |

When all checked: update `LAUNCH_STATUS_REPORT.md` — move **Payments live IPN** and **Mobile UX** from OPERATOR PENDING → **DONE**.

---

## Related docs

- `NOWPAYMENTS_SETUP.md` — IPN URL, Cloudflare allowlist, env vars
- `MANUAL_TASKS.md` §4.5 — Sovereign Vault smoke (subscription + credit pack)
- `MOBILE_UX_REPORT.md` — mobile identity matrix
- `LAUNCH_STATUS_REPORT.md` — GO/NO-GO matrix

---

## Explicitly out of scope (this checklist)

- Launching Agathon scans (OpenRouter credits)
- War Machine scrape beyond health check
- Phase 4 Intel Vault OSINT queries (separate from this smoke)
