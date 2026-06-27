# Crypto Checkout v3 — Dual QR White-label USDT TRC20

Sovereign Vault checkout is **white-label**: users send USDT TRC20 directly to
the NOWPayments-generated deposit address. Two QR codes cover both exchange and
wallet-app flows; a hosted NOWPayments page is offered only as an optional
collapsed link — never the default QR.

## Dual-QR matrix

| Mode | QR payload | Best for |
|------|------------|----------|
| **Address (primary)** | raw `pay_address` (e.g. `TXyz…`) | Bybit, Binance, exchanges — paste into Withdraw form. Exchanges don't read `tron:` deep links. |
| **Wallet app** | `tron:{pay_address}?amount={pay_amount}` | TronLink, Trust Wallet — scan to pre-fill the send |

Both QRs are black-on-white via `api.qrserver.com` (`color=000000`, `bgcolor=ffffff`).

**Banner:** "Bybit / Binance: Withdraw → USDT → TRC20 → paste the address below
manually. Do not scan the tron: QR — exchanges don't read deep links."

**Optional collapsed link:** "Prefer the hosted checkout page?" → reveals
"Open NOWPayments hosted page" using `invoice_url` from the API (only if
returned). Not the default, not in any QR.

## Implementation

| Component | Change |
|-----------|--------|
| `src/lib/payments/crypto.ts` | `buildPlainAddressQrCodeUrl()`; `is_fixed_rate: false` in `POST /v1/payment`; always prefer `data.pay_amount`; surface optional `invoiceUrl` |
| `src/app/dashboard/billing/crypto-actions.ts` | `GenerateDepositResult` exposes `plainQrCode` + `walletQrCode` (+ `qrCode` = plain); optional `invoiceUrl` |
| `src/app/dashboard/billing/sovereign-vault-modal.tsx` | Dual-QR toggle, Bybit banner, 10s poll, exact amount display, optional hosted-page link |
| `src/app/api/webhooks/nowpayments/route.ts` | Unchanged — IPN → `grantConfirmedCryptoDeposit` on confirmed |

## pay_amount

- QR amount always uses NOWPayments `data.pay_amount` when present (fallback
  `resolveCatalogPayAmount`).
- Modal displays the exact amount (up to 6 decimals, e.g. `10.012345 USDT`).

## Polling + activation

- Auto-poll every **10s** while the modal is open (`verifyCryptoDeposit`).
- Manual **"I Have Sent Payment"** polls NOWPayments API.
- IPN webhook → `crypto_deposits.status = confirmed` → `grantConfirmedCryptoDeposit`.
- All three paths converge on `subscriptions.status = active` (or wallet credits
  for packs). `grantConfirmedCryptoDeposit` is idempotent via `credits_granted`.

## Error handling

| Condition | User message |
|-----------|--------------|
| HTTP 429 | Payment service busy, retry in 60s |
| Network / API failure | Payments temporarily unavailable |
| Missing API key | Payments temporarily unavailable |

Never falls back to a static `SOVEREIGN_CRYPTO_WALLET` without a `payment_id`.

## Environment (never embedded in code)

`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NEXT_PUBLIC_APP_URL`

## Fresh payment per modal open

Each Sovereign Vault open calls `createNowPayment()` → new `payment_id` row in
`crypto_deposits`.

## Acceptance

| # | Criterion |
|---|-----------|
| 1 | Plain QR decodes to raw `T…` address (for exchange copy) |
| 2 | Wallet QR decodes to `tron:T…?amount=10` (for TronLink) |
| 3 | No redirect links as default QR; hosted page only as collapsed option |
| 4 | Each modal open creates new `payment_id` in DB |
| 5 | IPN + poll both activate subscription |
| 6 | `npm run build` PASS |
