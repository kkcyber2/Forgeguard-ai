# LAUNCH_STATUS_REPORT — ForgeGuard AI

**Generated:** 2026-06-15T15:30:00Z (UTC)  
**Supabase project:** `nlginrukltrwpkyujzzx` (ACTIVE_HEALTHY)  
**Vercel project:** `forgeguard-ai` (`prj_WU7JPbHjAUlMikaF6i1KIMJQ22Fl`)  
**Railway project:** `reliable-spontaneity` → services `AI-red-team` (Agathon), `war-machine` (Marine Swarm API)  
**War Machine API:** `https://war-machine-production.up.railway.app`  
**Last local build:** 2026-06-15 — identity consolidation + mobile UX (`f1c0685`) **deployed**

---

## Identity UX (2026-06-15 — P0 fix)

| Item | Status |
|------|--------|
| Single face flow (FaceLiveness only) | **Deployed** |
| WebcamIdentity removed from Settings | **Deployed** |
| Identity Auditor → gov ID file only | **Deployed** |
| Upload MIME sniff + file preview | **Deployed** |
| Mobile clearance-first layout | **Deployed** |
| `20260620_identity_proofed_to_liveness` migration | **Applied live** |

See `CITADEL_LAUNCH_VAULT/MOBILE_UX_REPORT.md`.

---

## MCP health check (2026-06-15)

| MCP | Call | Result |
|-----|------|--------|
| **Supabase** | `apply_migration` (`face_liveness`) | OK — columns live on `profiles` |
| **Supabase** | `execute_sql` | OK — `face_liveness_verified`, `face_liveness_at`, `face_liveness_pose_count` |
| **Vercel** | `web_fetch_vercel_url` launch-check | OK — **200** |
| **Railway** | `curl /health` | OK — `{"ok":true,"service":"war-machine","status":"healthy"}` |

---

## Status matrix

| Area | Status | Summary |
|------|--------|---------|
| **DB** | **Green** | Face liveness migration applied; security invoker views live |
| **PSI / PageSpeed** | **Green** | Lighthouse UA → 200 `text/html` (prior fix deployed) |
| **Payments** | **Green** | Production launch-check `crypto.configured: true` (2026-06-15) |
| **Engine** | **Green** | Agathon probe ~250 ms |
| **Webhooks** | **Yellow** | NOWPayments keys set; live $10 IPN smoke test still operator-owned |
| **Env** | **Green** | Core vars set; optional `UPSTASH_*` not required |
| **War Machine v2** | **Green** | `warMachine: true`; `/health` 200 |
| **Face liveness (Phase 1)** | **Yellow** | Code + migration ready; **deploy Vercel** to ship UI |
| **Security (Supabase advisors)** | **Yellow** | 0 ERROR; WARN remain (leaked-password protection, permissive RLS) |
| **Cloudflare** | **Red** | DNS not proxied yet (`Server: Vercel` only) — operator task |

**Overall launch-check (production, pre–face-liveness deploy):** `ok: true`

---

## Production launch-check (2026-06-15T15:26:24Z)

```json
{
  "ok": true,
  "checks": {
    "crypto": { "configured": true, "nowpayments": true, "ipnSecret": true, "sovereignWallet": true },
    "engineEnv": { "urlSet": true, "tokenSet": true },
    "engineProbe": { "ok": true, "httpStatus": 200, "latencyMs": 250 },
    "supabase": { "urlSet": true, "anonKeySet": true, "serviceRoleSet": true },
    "openrouter": true,
    "warMachine": true
  }
}
```

---

## Phase 1 — Face liveness (implemented locally)

| Item | Status |
|------|--------|
| `PhoneVerification` removed from settings / clearance | Done |
| `face-liveness.tsx` — 5-pose guided scan, `facingMode: user` | Done |
| `submitFaceLiveness()` → `verification-docs/{userId}/liveness/` | Done |
| Profile columns + migration `20260619_face_liveness` | Applied live via Supabase MCP |
| Clearance ladder → "Face liveness verified" | Done |
| `trust-score.ts` → `faceLivenessVerified` weight | Done |
| Twilio deprecated for clearance (legacy path kept) | Done |
| Enterprise ID upload (`identity-auditor`) | Unchanged |

**Deploy:** `vercel deploy --prod` from `forgeguard-ai/` after review.

---

## Phase 2 — Defense hardening

| Item | Status |
|------|--------|
| Upstash rate limit on `/auth/*` + `/api/webhooks/*` | Wired in middleware when `UPSTASH_*` set |
| Cloudflare WAF / NOWPayments IP allowlist | Documented in `MANUAL_TASKS.md` §2b |
| `ENV_MATRIX.md` | Updated (Twilio deprecated, Upstash wired) |
| Leaked password + MFA | Operator manual in `MANUAL_TASKS.md` §2a |

---

## Missing / optional env vars (post MCP check)

| Platform | Variable | Notes |
|----------|----------|-------|
| Vercel | `UPSTASH_REDIS_REST_URL` | Optional — in-memory fallback active |
| Vercel | `UPSTASH_REDIS_REST_TOKEN` | Optional |
| Vercel | `TWILIO_*` | Optional — legacy SMS only; not clearance |
| Operator | Cloudflare proxy | Not code — see `MANUAL_TASKS.md` §2b |

**No P0 blockers** on Vercel/Railway env for launch-check.

---

## War Machine v2

- Railway `GET /health` → **200** healthy
- Vercel `WAR_MACHINE_URL` set; admin **Fire Marine Swarm** → `POST /scrape` **202**
- GitHub push for local war-machine commits still manual (`3073250`, `440d44e`, `7a8a510`)

---

## Operator next steps

1. **Deploy** face liveness + Upstash middleware to Vercel production.
2. **Cloudflare** — proxy domain, WAF rules, NOWPayments IP allowlist (`NOWPAYMENTS_SETUP.md`).
3. **Smoke test** — Settings → Face liveness (5 poses) + $10 crypto IPN.
4. **Auth** — Enable leaked password protection + admin MFA in Supabase Dashboard.
5. **Push** war-machine repo commits to GitHub.

---

## Related vault docs

- `MANUAL_TASKS.md` — Cloudflare, face liveness migration, MFA
- `NOWPAYMENTS_SETUP.md` — receiving vs withdrawing, curl tests
- `ENV_MATRIX.md` — full env reference
- `SECURITY_HARDENING_REPORT.md` — P0–P2 code hardening
