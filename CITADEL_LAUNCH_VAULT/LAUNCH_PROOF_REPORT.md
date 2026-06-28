# LAUNCH_PROOF_REPORT — 2026-06-28 (Build Fix Test Push sprint)

Automated verification from Launch Proof Sprint + Real Developer System +
Build/Fix/Test/Push sprint. Operator-only steps remain where noted.

**Supabase:** `nlginrukltrwpkyujzzx`  
**Local forgeguard-ai HEAD:** `2d60e68` (Real Developer System + launch docs)  
**Local AI-red-team HEAD:** `bd118f4` (test-probe, Brain catalog, operator telemetry)  
**Engine:** `https://engine.forgeguard-ai.com/health` → healthy (confirm SHA post-push)

---

## Step 1 — Deploy

| Check | Result | Evidence |
|-------|--------|----------|
| Git push `forgeguard-ai` main | **PENDING** | Local @ `2d60e68`; origin was `da2e36d` |
| Vercel prod deploy | **PENDING** | Auto-deploy on push |
| AI-red-team push | **PENDING** | Local 3 commits ahead of `6577c2c` |
| Railway redeploy | **OPERATOR** | Confirm engine SHA matches `bd118f4` after push |

---

## Step 2 — Supabase migrations

| Object | Result |
|--------|--------|
| `notification_preferences` + RLS | **PASS** |
| `custom_attack_tools` | **PASS** |
| `operator_tool_executions` + RLS | **PASS** (verified live 2026-06-28) |
| `attack_lessons` | **PASS** |
| `schema_drift_reconciliation` | **PASS** |
| `aegis_rules.verified_blocks_attack` | **PASS** |
| `aegis_rules.cloudflare_rule_id` | **PASS** |
| `social-posts` storage bucket | **PASS** |
| `profiles.hacker_rank` → text | **PASS** |

---

## Step 3 — Curl preflight (OPERATOR_SMOKE Step 0)

| Probe | Result | Notes |
|-------|--------|-------|
| `GET /api/health/engine` | **PASS** | `ok:true` |
| `GET /api/health` | **PASS** | healthy |
| `GET engine.forgeguard-ai.com/health` | **PASS** | Agathon-Sovereign |
| `GET /api/debug/launch-check` (no auth) | **PASS** | **404** (no env leak) |
| `POST /api/webhooks/nowpayments` | **429** | Aegis PoW on operator IP; route live |
| `GET /api/debug/launch-check` (token/sovereign) | **OPERATOR** | Requires sovereign session or token |

---

## Step 4 — Billing (D3)

| Check | Result |
|-------|--------|
| Checkout creates `crypto_deposits` row | **PASS** |
| Live USDT payment + IPN | **OPERATOR PENDING** |
| Wallet grant on confirm | **OPERATOR PENDING** |

---

## Step 5 — D1 / D2 (browser)

| Section | Automated pre-check | Browser sign-off |
|---------|---------------------|------------------|
| D1 tenant isolation | RLS verified | **OPERATOR** — incognito fresh signup |
| D2 sovereign/admin | `launch-check` 404 unauthenticated | **OPERATOR** — login + `/admin/audit` |

---

## Step 6 — Scan E2E (OpenRouter)

| Check | Result | Notes |
|-------|--------|-------|
| Scope unit tests | **PASS** | 3/3 via `npm run test:unit` |
| Audit chain unit tests | **PASS** | 2/2 |
| Closed-loop unit tests | **PASS** | 6/6 (tsx runner) |
| `training_corpus_events` | **32 rows** | Prior scans; new greasy scan still recommended |
| Greasy smoke scan | **OPERATOR PENDING** | OpenRouter recharge on Railway |

---

## Step 7 — D6 CI / build (2026-06-28 local)

| # | Check | Result |
|---|-------|--------|
| 1 | `npm run typecheck` | **PASS** |
| 2 | `npm run build` local | **PASS** (35 routes; clear `.next` if OneDrive EINVAL) |
| 3 | `npm run test:unit` | **PASS** — 11 tests |
| 4 | `pytest tests/ -q` (AI-red-team) | **PASS** — 48 passed |
| 5 | `ruff check .` + orchestrator import | **PASS** |
| 6 | Engine health curl | **PASS** |
| 7 | GitHub Actions | **OPERATOR** — verify after push (`gh auth login`) |

---

## Real Developer System

| Feature | Status | Notes |
|---------|--------|-------|
| `POST /developer/test-probe` (engine) | **SHIPPED** | Docker sandbox via `_run_sandboxed_probe` |
| `POST /api/developer/test-tool` (gateway) | **SHIPPED** | Rank ≥3, 5/min rate limit |
| Brain operator arsenal in kickoff | **SHIPPED** | `load_approved_tools()` |
| `operator_tool_executions` telemetry | **SHIPPED** | Replaces broken `tool_executions` FK |
| Developer console UI | **SHIPPED** | `/dashboard/developer` test modal + run history |
| **Docker on Railway** | **OPERATOR** | `agathon-sandbox:latest` + Docker daemon required for sandbox in prod |

---

## Operator handoff (remaining before demo-ready)

1. **Push + deploy** — forgeguard-ai `2d60e68`, AI-red-team `bd118f4` → Vercel + Railway
2. **OpenRouter recharge** → greasy smoke scan → D4/D5 audit chain on new scan
3. **$10 credit pack IPN** — complete payment, confirm wallet + credits
4. **Mobile identity** — face liveness + gov ID at 390×844
5. **D1/D2 browser** — incognito tenant test + sovereign admin session
6. **Engine Docker sandbox** — confirm Railway has Docker + `agathon-sandbox:latest`

Helper script: `node scripts/launch-proof-audit.mjs`
