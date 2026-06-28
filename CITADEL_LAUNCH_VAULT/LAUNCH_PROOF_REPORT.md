# LAUNCH_PROOF_REPORT — 2026-06-28

Automated + MCP verification from the Launch Proof Sprint. Operator-only steps
remain where noted.

**Supabase:** `nlginrukltrwpkyujzzx`  
**Production SHA:** `da2e36d` (Vercel `dpl_2DfWvsvQvS38V15k3z1zQQFFSLhB`, READY)  
**Engine:** `https://engine.forgeguard-ai.com/health` → healthy, registry 170

---

## Step 1 — Deploy

| Check | Result | Evidence |
|-------|--------|----------|
| Git push `forgeguard-ai` main | **PASS** | `origin/main` @ `da2e36d` (8 commits) |
| Vercel prod deploy | **PASS** | Git-triggered deploy READY; aliased `forgeguard-ai.com` |
| Vercel CLI deploy (backup) | **PASS** | `dpl_5j1oZ6quZZ6zCNbPLCu4Hr3miEy2` (same SHA) |
| AI-red-team push | **PASS** | `d793d9a` on `origin/main` (2 commits) |
| Railway redeploy | **OPERATOR** | Railway MCP unauthorized — confirm engine SHA in Railway dashboard |

---

## Step 2 — Supabase migrations

| Object | Result |
|--------|--------|
| `notification_preferences` + RLS | **PASS** (applied + verified live) |
| `custom_attack_tools` | **PASS** |
| `attack_lessons` | **PASS** |
| `schema_drift_reconciliation` | **PASS** |
| `aegis_rules.verified_blocks_attack` | **PASS** |
| `aegis_rules.cloudflare_rule_id` | **PASS** |
| `social-posts` storage bucket | **PASS** (public read) |
| `profiles.hacker_rank` → text | **PASS** |

---

## Step 3 — Curl preflight (OPERATOR_SMOKE Step 0)

| Probe | Result | Notes |
|-------|--------|-------|
| `GET /api/health/engine` | **PASS** | `ok:true`, latency ~190–230ms |
| `GET /api/health` | **PASS** | healthy |
| `GET engine.forgeguard-ai.com/health` | **PASS** | Agathon-Sovereign |
| `GET /api/debug/launch-check` (no auth) | **PASS** | **404** (no env leak) — D2 step 4 |
| `POST /api/webhooks/nowpayments` | **429** | Aegis PoW on operator IP; route live (not 5xx). NOWPayments uses their own IPs for real IPN. |
| `GET /api/debug/launch-check` (token/sovereign) | **OPERATOR** | Requires sovereign session or `INTERNAL_SCAN_TOKEN` header |

---

## Step 4 — Billing (OPERATOR_SMOKE Step 1 / D3)

| Check | Result | Evidence |
|-------|--------|----------|
| Checkout creates `crypto_deposits` row | **PASS** | Recent rows with `invoice_url`, `order_id`, `payment_id` |
| Invoice redirect flow (not QR modal) | **PASS** | `createCheckoutInvoice` → NOWPayments hosted page |
| Live USDT payment + IPN | **OPERATOR PENDING** | All recent deposits `status=pending`, `credits_granted=false` |
| Wallet grant on confirm | **OPERATOR PENDING** | Send exact USDT; verify Vercel logs + wallet +$10 (credit pack) |

Recent pending deposits (2026-06-27/28): credit pack $10 and subscription $49 rows with invoice URLs.

---

## Step 5 — D1 / D2 (browser)

| Section | Automated pre-check | Browser sign-off |
|---------|---------------------|------------------|
| D1 tenant isolation | RLS on `scans` (`scans_select_own_or_admin`), `social_posts_read` owner-scoped | **OPERATOR** — incognito fresh signup |
| D2 sovereign/admin | `launch-check` 404 unauthenticated; sovereign email `ksk805763@gmail.com` in code | **OPERATOR** — login + `/admin/audit` verify |

---

## Step 6 — Scan E2E (OpenRouter)

| Check | Result | Notes |
|-------|--------|-------|
| Scope logic unit tests | **PASS** | `node --test src/lib/scans/scope.test.ts` — 3/3 |
| Existing sealed scans | 4 sealed, 0 `scan_audit_events` | Pre–Phase 1 scans; audit chain populates on **new** scans only |
| `training_corpus_events` | **0 rows** | Needs new sealed scan post-deploy |
| Aegis closed-loop on greasy scan | **0 rules** | Needs new scan with findings + closed-loop panel |
| Greasy smoke scan | **OPERATOR PENDING** | Recharge OpenRouter on Railway; run 5-step checklist in `SCAN_STUCK_DEBUG.md` |

---

## Step 7 — D6 CI / build

| # | Check | Result |
|---|-------|--------|
| 1 | `npm run build` local | **PASS** (Vercel remote build) |
| 2 | forgeguard-ai CI | **OPERATOR** — `gh auth login` required to verify Actions |
| 3 | AI-red-team CI | **OPERATOR** — same |
| 4 | `pytest tests/test_health.py` + remediation | **PASS** — 13 passed |
| 5 | Vercel prod @ `da2e36d` | **PASS** |
| 6 | Engine health curl | **PASS** |
| 7 | Aegis closed-loop columns live | **PASS** |

---

## Operator handoff (remaining before demo-ready)

1. **OpenRouter recharge** on Railway → run greasy smoke scan → D4/D5 + training corpus row
2. **$10 credit pack IPN** — complete payment, confirm wallet + credits
3. **Mobile identity** — face liveness + gov ID at 390×844 (`OPERATOR_SMOKE` Step 2)
4. **D1/D2 browser** — incognito tenant test + sovereign admin session
5. **Railway** — confirm AI-red-team deploy matches `d793d9a`

Helper script: `node scripts/launch-proof-audit.mjs` (audit chain + training count after new scan).
