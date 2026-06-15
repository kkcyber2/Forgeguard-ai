# ENV_MATRIX — ForgeGuard AI Launch

Legend: **V** = Vercel required · **R** = Railway required · **O** = optional · **D** = deprecated

---

## Vercel (`forgeguard-ai/`)

| Variable | V | O | D | Purpose |
|----------|---|---|---|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | | | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | | | Client + middleware session |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | | | Admin RPC, webhooks, scan launcher |
| `NEXT_PUBLIC_APP_URL` | ✓ | | | Canonical URL (`https://www.forgeguard-ai.com`) |
| `PYTHON_ENGINE_URL` | ✓ | | | Railway Agathon orchestrator |
| `INTERNAL_SCAN_TOKEN` | ✓ | | | Engine auth (must match Railway) |
| `WAR_MACHINE_URL` | ✓ | | | Lead scraper / war-machine service |
| `NOWPAYMENTS_API_KEY` | ✓ | | | Sovereign Vault checkout |
| `NOWPAYMENTS_IPN_SECRET` | ✓ | | | IPN HMAC verification |
| `OPENROUTER_API_KEY` | ✓ | | | Compliance AI, verification triage |
| `SCAN_CREDENTIAL_SECRET` | ✓ | | | Target credential encryption |
| `ALLOWED_ORIGINS` | ✓ | | | CORS allowlist |
| `SOVEREIGN_OPERATOR_EMAIL` | ✓ | | | Admin / sovereign gate |
| `CREDIT_PACK_USD` | | ✓ | | Credit pack price (default 10) |
| `CREDIT_PACK_AMOUNT` | | ✓ | | Credits per pack (default 100) |
| `SCAN_OVERAGE_WALLET_DEBIT_USD` | | ✓ | | Wallet debit per overage scan (default 1) |
| `SOVEREIGN_CRYPTO_WALLET` | | ✓ | | Fallback static USDT address |
| `GROQ_API_KEY` | | ✓ | | Optional direct Groq (engine uses Railway) |
| `REVENUE_SIMULATION_MODE` | | ✓ | | Dev billing bypass |
| `TWILIO_ACCOUNT_SID` | | ✓ | D | Legacy SMS OTP — not required for clearance |
| `TWILIO_AUTH_TOKEN` | | ✓ | D | Legacy SMS OTP |
| `TWILIO_PHONE_NUMBER` | | ✓ | D | Legacy SMS OTP |
| `TWILIO_SIMULATION_MODE` | | ✓ | | Dev OTP bypass (legacy path only) |
| `UPSTASH_REDIS_REST_URL` | | ✓ | | Distributed rate limit on `/auth/*` + `/api/webhooks/*` (wired in middleware when set) |
| `UPSTASH_REDIS_REST_TOKEN` | | ✓ | | Paired with REST URL |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | | ✓ | | In-memory middleware fallback |
| `LEMONSQUEEZY_*` | | | ✓ | Legacy — bazaar optional only |
| `STRIPE_*` / `NEXT_PUBLIC_STRIPE_*` | | | ✓ | Removed from billing flow |
| `AGATHON_ORCHESTRATOR_URL` | | ✓ | D | Alias of `PYTHON_ENGINE_URL` |
| `AGATHON_INTERNAL_SECRET` | | ✓ | D | Alias of `INTERNAL_SCAN_TOKEN` |
| `ADMIN_EMAIL` | | ✓ | | Fallback sovereign operator |
| `NODE_ENV` | auto | | | Set by platform |

---

## Railway (`AI-red-team/` — Agathon engine)

| Variable | R | O | D | Purpose |
|----------|---|---|---|---------|
| `SUPABASE_URL` | ✓ | | | Same project as Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | | | Scan updates, webhooks |
| `INTERNAL_SCAN_TOKEN` | ✓ | | | Must match Vercel |
| `GROQ_API_KEY` | ✓ | | | Primary LLM for probes |
| `OPENROUTER_API_KEY` | ✓ | | | Judge / DeepSeek routes |
| `AGATHON_WEBHOOK_CALLBACK_URL` | ✓ | | | `https://www.forgeguard-ai.com/api/v1/webhooks/agathon` |
| `PORT` | auto | | | Railway injects |
| `AGATHON_LOG_LEVEL` | | ✓ | | Default INFO |
| `AGATHON_GREASY_AUTOAPPROVE` | | ✓ | | Dev only |
| `AGATHON_SWARM` | | ✓ | | Multi-worker mode |
| `AGATHON_DOCKER_IMAGE` | | ✓ | | Sandbox image |
| `WAR_MACHINE_LEADS_TABLE` | | ✓ | | War machine scraper |
| `AGATHON_WEBHOOK_SECRET` | | ✓ | D | Legacy webhook auth alias |

---

## Railway — War Machine v2 (`kkcyber2/war-machine`, service `war-machine`)

| Variable | R | O | Purpose |
|----------|---|---|---------|
| `SUPABASE_URL` | ✓ | | Lead storage (`nlginrukltrwpkyujzzx`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | | Lead writes |
| `INTERNAL_SCAN_TOKEN` | ✓ | | Must byte-match Vercel |
| `HEADLESS` | ✓ | | `true` in production |
| `MAX_LEADS_PER_RUN` | | ✓ | Default 50 |
| `OPENROUTER_API_KEY` | | ✓ | Outreach stage |
| `RESEND_API_KEY` | | ✓ | Outreach stage |

**API URL (Vercel `WAR_MACHINE_URL`):** `https://war-machine-production.up.railway.app`

---

## Missing on production (verify in dashboards)

| Platform | Variable | Risk if missing |
|----------|----------|-----------------|
| Vercel | `NOWPAYMENTS_API_KEY` | Crypto checkout disabled |
| Vercel | `NOWPAYMENTS_IPN_SECRET` | IPN rejected (401) until set |
| Vercel | `SOVEREIGN_CRYPTO_WALLET` | Optional crypto fallback |
| Vercel | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional — falls back to in-memory rate limit |
| Vercel | `ALLOWED_ORIGINS` | CORS may block API from www |
| Railway | `AGATHON_WEBHOOK_CALLBACK_URL` | Scan completion webhooks fail |

**Set 2026-06-14:** Vercel `WAR_MACHINE_URL` → `https://war-machine-production.up.railway.app`

---

## Log inspection (operator)

**Vercel:** Project → Logs → filter `nowpayments`, `scan-launcher`, `agathon`  
**Railway:** AI-red-team service → Deployments → View Logs → filter `webhook`, `GROQ`  
**Supabase:** Dashboard → Logs → Postgres / API / Auth (last 24h)  
**War machine:** Railway war-machine service logs if deployed separately
