# LAUNCH_STATUS_REPORT — ForgeGuard AI

**GO/NO-GO audit:** 2026-06-17T16:25:00Z (UTC) · **Operator smoke doc:** 2026-06-13  
**Supabase:** `nlginrukltrwpkyujzzx` (ACTIVE_HEALTHY)  
**Vercel:** `forgeguard-ai` — production **`11bd6fd`** (`dpl_JNR6BPVG2gmtny8Y852sz8obCVPB`)  
**War Machine:** `https://war-machine-production.up.railway.app`  
**Agathon:** Railway `AI-red-team` @ `85c55d0`  
**Company registration:** N/A — not required for launch

**Operator checklist:** `CITADEL_LAUNCH_VAULT/OPERATOR_SMOKE.md` (billing + identity + curl preflight; **no new scans**)

---

## GO/NO-GO matrix (2026-06-13 update)

| Layer | Status | Evidence |
|-------|--------|----------|
| **Git/Vercel** | **Green** | `main` @ `11bd6fd`; prod deploy READY; `npm run build` PASS |
| **Env** | **Green** | launch-check `envMatrixComplete: true` (13 required vars) |
| **Payments config** | **Green** | `crypto.configured: true`, `nowpayments: true`, `ipnSecret: true` |
| **Payments live IPN** | **OPERATOR PENDING** | Step 1 in `OPERATOR_SMOKE.md` — $10 credit pack + IPN log |
| **Engine (Agathon)** | **Green** | `GET /api/health/engine` + launch-check `engineProbe.ok` |
| **War Machine health** | **Green** | `GET /health` → `status: healthy` |
| **War Machine scrape→leads** | **Green** | 50 `producthunt` leads; `WAR_MACHINE_E2E_REPORT.md` PASS |
| **Identity UX (code)** | **Green** | FaceLiveness + gov ID upload; WebcamIdentity removed |
| **Mobile UX (operator test)** | **OPERATOR PENDING** | Step 2 in `OPERATOR_SMOKE.md` — 390×844 liveness + ID |
| **PSI / Lighthouse** | **Green** | Lighthouse UA → **200** on `/`, `/about`, `/auth/login` |
| **Supabase DB** | **Green** | `face_liveness_*`; `verification-docs`; RPC lockdown applied |
| **Cloudflare** | **Yellow** | Not proxied — `MANUAL_TASKS.md` §2b |
| **Company registration** | **N/A** | Not a launch blocker |

---

## Launch verdict

### **GO**

Public launch is **approved** for core product flows:

- Production health + env matrix **green**
- Agathon engine **healthy** (health probe only — no scan required for this sign-off)
- Payments **configured**; live IPN = operator Step 1 in `OPERATOR_SMOKE.md`
- Identity consolidation **deployed**; mobile proof = operator Step 2
- War Machine **verified** (50 PH leads)

**Operator pending (non-blocking):** live $10 IPN test, mobile face liveness phone test, Cloudflare proxy.

---

## P0 fix — billing (2026-06-13)

**Credit pack wallet grant:** DB trigger + `grantConfirmedCryptoDeposit()` incorrectly used `credit_amount` (100) for `increment_wallet` instead of `amount_usdt` ($10).

- Migration: `20260625_credit_pack_wallet_grant.sql` (applied live)
- App: `src/lib/payments/crypto.ts` — credit_pack uses `amount_usdt` only

Verify after IPN: wallet increases by **$10**, not $100.

---

## Operator handoff

| # | Task | Doc | Status |
|---|------|-----|--------|
| 0 | curl preflight (launch-check + engine + IPN route) | `OPERATOR_SMOKE.md` Step 0 | **Automated — run & check** |
| 1 | $10 Sovereign Vault → `crypto_deposits` + Vercel IPN | `OPERATOR_SMOKE.md` Step 1 | **PENDING** |
| 2 | Face liveness + gov ID on phone 390×844 | `OPERATOR_SMOKE.md` Step 2 | **PENDING** |
| 3 | (Optional) Cloudflare proxy | `MANUAL_TASKS.md` | Post-launch |

---

## Phase 1 — Production health (automated)

### launch-check — verify on deploy

```powershell
curl -s https://www.forgeguard-ai.com/api/debug/launch-check
```

**Pass:** `ok: true`, `checks.crypto.configured: true`, `checks.engineProbe.ok: true`, `checks.envMatrixComplete: true`

**Live snapshot (2026-06-21T04:01Z):** `ok: true`, engine latency **194ms**, registry **161**.

### engine health

```powershell
curl -s https://www.forgeguard-ai.com/api/health/engine
```

**Pass:** HTTP 200, `status: healthy`, latency &lt; 2s

### HTTP probes (2026-06-17 baseline)

| Route | Status | Notes |
|-------|--------|-------|
| `/api/health` | **200** | |
| `/api/health/engine` | **200** | **DONE** — operator re-run via Step 0 |
| `/api/debug/launch-check` | **200** | **DONE** — operator re-run via Step 0 |
| `/` (Lighthouse UA) | **200** | |
| `/about` (Lighthouse UA) | **200** | |
| `/auth/login` (Lighthouse UA) | **200** | |
| `/api/webhooks/nowpayments` POST | **401/400** | Route live (no valid sig in curl) |

---

## Phase 2 — War Machine E2E

See **`WAR_MACHINE_E2E_REPORT.md`** — **PASS** (50 producthunt leads).

---

## Phase 3 — Agathon scan pipeline

| Check | Result |
|-------|--------|
| Engine latency | **Green** via `/api/health/engine` |
| Webhook auth gate | **401** on unsigned POST |
| Full scan E2E | **Out of scope** — OpenRouter recharge required |

---

## Phase 4 — Identity + mobile

| Check | Result |
|-------|--------|
| FaceLiveness + gov ID upload (code) | **DONE** — deployed |
| Mobile browser test | **OPERATOR PENDING** — `OPERATOR_SMOKE.md` Step 2 |

---

## Phase 5 — Payments

| Check | Result |
|-------|--------|
| launch-check crypto | **DONE** — all flags true |
| `NOWPAYMENTS_SETUP.md` | Present |
| Pending row on checkout | **Code DONE** — `crypto-actions.ts` legacy column mirror |
| Live $10 IPN + wallet grant | **OPERATOR PENDING** — Step 1; P0 grant fix applied |

---

## Phase 6 — Security (non-blockers)

| Item | Status |
|------|--------|
| Supabase advisors ERROR | **0** (post RPC lockdown) |
| Cloudflare WAF | Not deployed |
| UPSTASH rate limit | Optional |

---

## Related docs

- **`OPERATOR_SMOKE.md`** — primary operator launch checklist (this report)
- `NOWPAYMENTS_SETUP.md`
- `MOBILE_UX_REPORT.md`
- `WAR_MACHINE_E2E_REPORT.md`
- `MANUAL_TASKS.md`
- `ROADMAP_PROGRESS.md`
