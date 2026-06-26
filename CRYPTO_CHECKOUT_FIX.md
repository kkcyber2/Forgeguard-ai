# Crypto Checkout Fix — Sovereign Vault QR v2

## Problem

Scanning the Sovereign Vault QR showed an address but did not open a wallet send flow with USDT TRC20 pre-filled. Bybit/Trust Wallet reported invalid payloads. `tron:{address}` without amount/contract is not supported by exchanges.

## Root cause

1. QR encoded bare `tron:{address}` — no amount, no USDT TRC20 contract.
2. Exchanges (Bybit, etc.) do not support `tron:` deep links — users must withdraw manually.
3. Static `SOVEREIGN_CRYPTO_WALLET` fallback could not auto-confirm via NOWPayments polling/IPN.

## Fix (v2)

| Component | Change |
|-----------|--------|
| `src/lib/payments/crypto.ts` | `USDT_TRC20_CONTRACT`, `buildTronUsdtTrc20Uri()`, full TRC20 URI with amount + contract; QR prefers `pay_url` |
| `src/lib/payments/crypto-format.ts` | Client-safe contract constant for UI instructions |
| `src/app/dashboard/billing/crypto-actions.ts` | Dual QR (`checkoutQrCode` + `walletQrCode`); **no static wallet fallback**; `grantConfirmedCryptoDeposit` on verify |
| `src/app/dashboard/billing/sovereign-vault-modal.tsx` | Dual-tab UX, Bybit instructions, auto-poll 15s, operator `payment_id` footer |
| `supabase/migrations/20260630_tenant_rls_hardening.sql` | `crypto_deposits.pay_amount` column |

### Dual-QR strategy

| Mode | QR payload | Best for |
|------|------------|----------|
| **Crypto app** (primary) | NOWPayments `pay_url` / `invoice_url` | Bybit, Trust Wallet, exchange apps — scan or open checkout page |
| **Send from wallet** | `tron:{addr}?amount=49&token=USDT&contractAddress=TR7NHq…` | TronLink, Trust Wallet deep link |

QR generation priority in `buildCryptoQrCodeUrl()`:

1. If `payUrl` present → encode checkout URL (best compatibility)
2. Else if `usdttrc20` → encode full TRC20 URI
3. Black-on-white (`api.qrserver.com`) for scanner contrast

### TRC20 URI format

```
tron:{address}?amount={payAmount}&token=USDT&contractAddress=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

USDT TRC20 mainnet contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (6 decimals)

### Exchange instructions (Bybit)

1. Assets → **Withdraw**
2. Coin: **USDT**
3. Network: **TRC20** (not ERC20/BEP20)
4. Paste deposit address from modal
5. Amount: exact catalog USDT (e.g. `49`, `199`, `10`)

Exchanges **cannot** scan `tron:` QR — use **Send from wallet** tab address copy.

### NOWPayments configuration

| Setting | Value |
|---------|--------|
| IPN callback URL | `https://forgeguard-ai.com/api/webhooks/nowpayments` |
| Vercel env | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NEXT_PUBLIC_APP_URL` |

If NOWPayments API fails → modal shows **"Payments temporarily unavailable"** (no static wallet fallback).

### Payment activation flow

1. User opens Sovereign Vault → `createNowPayment()` → row in `crypto_deposits` with `payment_id`
2. User pays via checkout URL or manual TRC20 send
3. Confirmation paths (belt + suspenders):
   - IPN webhook → `crypto_deposits.status = confirmed` → DB trigger + `grantConfirmedCryptoDeposit`
   - Manual **"I Have Sent Payment"** → `verifyCryptoDeposit()` polls NOWPayments API
   - **Auto-poll** every 15s while modal open (`verifyCryptoDeposit`)
4. `grantConfirmedCryptoDeposit()` → `subscriptions.status = active` (or wallet credits for packs)

### Operator debug footer

When `showOperatorDebug` (sovereign operator) or `NODE_ENV=development`, modal footer shows:

```
NOWPayments payment_id: {id} · deposit: {uuid-prefix}
```

Use `payment_id` to look up payment in NOWPayments dashboard.

## Acceptance checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | QR opens NOWPayments checkout OR TronLink with USDT TRC20 + amount | Code complete — operator verify on device |
| 2 | Modal shows Bybit withdraw TRC20 instructions | PASS |
| 3 | Test $10 payment → `crypto_deposits` confirmed → `subscriptions.status = active` | Operator verify |
| 4 | Manual verify + 15s auto-poll both activate plan | PASS (code) |
| 5 | `pay_url` used as primary QR when NOWPayments returns it | PASS |

## Test matrix

| Step | Expected |
|------|----------|
| Generate Startup deposit | Two tabs: Crypto app + Send from wallet; checkout QR if `pay_url` returned |
| Scan checkout QR on phone | Opens NOWPayments hosted checkout |
| Scan wallet QR in TronLink | Pre-filled USDT TRC20 send with amount |
| NOWPayments API down | Error: "Payments temporarily unavailable" |
| Pay $10 test pack | `crypto_deposits.status = confirmed`, wallet or subscription granted |
| Sovereign operator view | `payment_id` visible in modal footer |

## Manual verification

1. `/dashboard/billing` → plan or credit pack → Sovereign Vault
2. **Crypto app** tab → scan QR or **Open checkout page**
3. **Send from wallet** tab → **Open in TronLink** / **Trust Wallet** or copy address (Bybit path)
4. Keep modal open — auto-poll every 15s after payment
5. NOWPayments dashboard: match `payment_id` from operator footer
