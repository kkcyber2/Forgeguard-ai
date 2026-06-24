# Crypto Checkout Fix — Sovereign Vault QR

## Root cause

QR encoded `TRON_ADDRESS?amount=49` using **USD plan price** instead of NOWPayments **`pay_amount`** (crypto). Wallets expect a payment URI (`tron:…`, `bitcoin:…`, `solana:…`).

## Fix

| component | change |
|-----------|--------|
| `src/lib/payments/crypto.ts` | `buildCryptoPaymentUri()` + QR uses URI not raw address |
| `src/app/dashboard/billing/crypto-actions.ts` | Pass `payAmount` + `payCurrency` to QR; store `pay_amount` on deposit |
| `src/app/dashboard/billing/sovereign-vault-modal.tsx` | Show crypto amount, **Open in wallet**, optional NOWPayments link |
| `supabase/migrations/20260630_tenant_rls_hardening.sql` | `crypto_deposits.pay_amount` column |

### URI matrix

| `pay_currency` | URI format |
|----------------|------------|
| `usdttrc20` / tron | `tron:{address}?amount={payAmount}` |
| `btc` | `bitcoin:{address}?amount={payAmount}` |
| `sol` | `solana:{address}?amount={payAmount}` |
| `usdterc20` / eth | `ethereum:{address}?value={payAmount}` |

## Test matrix

| step | expected |
|------|----------|
| Generate $10 Starter Pack deposit | Modal shows crypto amount (e.g. `10.xxx USDTTRC20`) not just USD |
| Scan QR in TronLink / Trust Wallet | Opens send screen with address + amount pre-filled |
| Copy address | Raw address still copies (unchanged) |
| IPN webhook `/api/webhooks/nowpayments` | Unchanged — still confirms `crypto_deposits` |
| `pay_amount` in DB | Row stores NOWPayments crypto amount |

## Manual verification

1. `/dashboard/billing` → credit pack → Sovereign Vault modal
2. Confirm QR payload starts with `tron:` (TRC20) not bare `T…` address
3. NOWPayments dashboard: test $10 payment → IPN hits Vercel logs
