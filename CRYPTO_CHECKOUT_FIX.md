# Crypto Checkout Fix — White-label USDT TRC20 (no redirect)

## Problem

Sovereign Vault previously encoded NOWPayments `pay_url` / `invoice_url` in QR codes and offered a checkout redirect tab. Product requirement: **white-label only** — users send USDT TRC20 directly to the NOWPayments-generated deposit address with no hosted checkout page.

## White-label QR format

Every USDT TRC20 QR and "Open in wallet" link encodes exactly:

```
tron:{pay_address}?amount={pay_amount}
```

- `pay_address` — from NOWPayments `POST /v1/payment` response (`data.pay_address`)
- `pay_amount` — from `data.pay_amount`, fallback `resolveCatalogPayAmount`
- **No** `token=`, **no** `contractAddress=`, **no** `invoice_url` or `pay_url`

Example: `tron:TXyz…?amount=10`

## Implementation

| Component | Change |
|-----------|--------|
| `src/lib/payments/crypto.ts` | `buildTronUsdtTrc20Uri()` → `tron:{addr}?amount={amount}`; `buildCryptoQrCodeUrl()` never encodes redirect URLs; `NowPaymentsRateLimitError` on HTTP 429; `isCryptoCheckoutConfigured()` = `NOWPAYMENTS_API_KEY` only |
| `src/app/dashboard/billing/crypto-actions.ts` | Single `qrCode` / `walletQrCode` (same tron URI); no `invoiceUrl`/`payUrl` in result; 429 → "Payment service busy, retry in 60s" |
| `src/app/dashboard/billing/sovereign-vault-modal.tsx` | Single wallet QR; Amount / Network TRC20 / Address; Bybit withdraw instructions; 15s auto-poll; operator `payment_id` footer |
| `src/app/api/webhooks/nowpayments/route.ts` | Unchanged — IPN → `grantConfirmedCryptoDeposit` on confirmed |

### QR styling

Black-on-white via `api.qrserver.com` (`color=000000`, `bgcolor=ffffff`) for scanner contrast.

### Fresh payment per modal open

Each Sovereign Vault open calls `createNowPayment()` → new `payment_id` row in `crypto_deposits`.

### Error handling

| Condition | User message |
|-----------|--------------|
| HTTP 429 from NOWPayments | Payment service busy, retry in 60s |
| Network / API failure | Payments temporarily unavailable |
| Missing API key | Payments temporarily unavailable |

Never falls back to static `SOVEREIGN_CRYPTO_WALLET` without a `payment_id`.

### Exchange instructions (Bybit)

1. Assets → **Withdraw**
2. Coin: **USDT**
3. Network: **TRC20** (not ERC20/BEP20)
4. Paste deposit address from modal
5. Amount: exact `pay_amount` shown (e.g. `10`, `49`, `199`)

Exchanges **cannot** scan `tron:` QR — copy the address manually.

### Payment activation flow

1. User opens Sovereign Vault → `createNowPayment()` → row in `crypto_deposits` with `payment_id`
2. User sends USDT TRC20 to deposit address (wallet scan or manual paste)
3. Confirmation paths:
   - IPN webhook → `crypto_deposits.status = confirmed` → `grantConfirmedCryptoDeposit`
   - Manual **"I Have Sent Payment"** → `verifyCryptoDeposit()` polls NOWPayments API
   - **Auto-poll** every 15s while modal open
4. `grantConfirmedCryptoDeposit()` → `subscriptions.status = active` (or wallet credits for packs)

## Acceptance checklist

| # | Criterion |
|---|-----------|
| 1 | QR decodes to `tron:T…?amount=10` (exact format, no extra params) |
| 2 | No NOWPayments redirect links in modal |
| 3 | Each modal open creates new `payment_id` in DB |
| 4 | Test payment → `crypto_deposits` confirmed → subscriptions active |
| 5 | `npm run build` PASS |
