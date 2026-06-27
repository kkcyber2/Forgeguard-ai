# DEMO_PROOF_CHECKLIST — manual smoke tests

**Supabase:** `nlginrukltrwpkyujzzx`
**Created:** 2026-06-27 (Stabilize, Prove & Finish pass)

Run these end-to-end in an incognito/sovereign browser session after the latest
deploy is green on Vercel **and** Railway. Each item has a clear PASS / FAIL
signal. Do not demo until every box is checked.

---

## D1 — Tenant isolation (fresh user)

**Setup:** Sign up a brand-new account (Client role) at `/auth/signup`.

| # | Step | PASS signal |
|---|------|-------------|
| 1 | Land on `/dashboard` | Overview cards all show **0** (scans, findings, ALE) |
| 2 | Open `/dashboard/scans` | Empty state — "No scans yet" |
| 3 | Open `/dashboard/analytics` | No foreign scan in ALE trend / breakdown |
| 4 | Paste a **foreign scan UUID** into `/dashboard/scans/[id]` | **404** (no existence leak) |
| 5 | Open `/dashboard/intel` Feed tab | Only the new user's own posts (no cross-tenant feed) |
| 6 | Tactical world map | No foreign `breach` pulses on the fresh account |

---

## D2 — Sovereign operator + admin

| # | Step | PASS signal |
|---|------|-------------|
| 1 | Log in as sovereign operator (env-listed email) | `/admin` reachable, sovereign chip in top bar |
| 2 | Open `/admin/audit` | Audit chain table loads; "Verify integrity" returns `valid=true` for a clean scan |
| 3 | Log in as a **normal** user and visit `/admin` | Redirected away from `/admin` (no access) |
| 4 | Visit `/api/debug/launch-check` with **no** auth | **404** (gated) |
| 5 | `curl -H "x-internal-scan-token: $INTERNAL_SCAN_TOKEN" /api/debug/launch-check` | **200** + env matrix |
| 6 | Sovereign session → `/api/debug/launch-check` | **200** + env matrix |

---

## D3 — Billing: Sovereign Vault crypto deposit

| # | Step | PASS signal |
|---|------|-------------|
| 1 | Open `/dashboard/billing` → Sovereign Vault → buy a pack | Modal opens |
| 2 | Wait for NOWPayments call | A **fresh** `pay_address` + `pay_amount` per click (not static) |
| 3 | Inspect QR data | Starts with `tron:<address>?amount=<pay_amount>` (protocol prefix present) |
| 4 | Scan QR with Bybit / TronLink | Wallet opens pre-filled to the **correct network + amount** — **not** "invalid QR" |
| 5 | Check Supabase `crypto_deposits` | Row has `pay_amount` populated |
| 6 | Polling | Modal polls payment status (~10s) and flips to "confirmed" on `finished` |
| 7 | On confirmation | Subscription / credits granted; dashboard reflects new plan |

---

## D4 — Scope enforcement + audit chain (Phase 1 trust layer)

| # | Step | PASS signal |
|---|------|-------------|
| 1 | Verified domain `example.com` tries to scan `victim.com` | **Blocked** — scope mismatch error |
| 2 | `example.com` scans `api.example.com` | **Allowed** — subdomain in scope |
| 3 | Sovereign operator scans any target | Bypasses scope gate |
| 4 | After a sealed scan, check `scan_audit_events` | Hash-chained rows; `verifyAuditChain` → `valid=true` |
| 5 | `/api/scans/[id]/audit-export` as owner | Signed evidence pack downloads |
| 6 | Same export as **non-owner** | **404** |

---

## D5 — Aegis closed-loop remediation (Phase 3, new this pass)

| # | Step | PASS signal |
|---|------|-------------|
| 1 | Open a **sealed** scan with findings → `/dashboard/scans/[id]` | "Aegis Closed-Loop Verification" panel renders under findings |
| 2 | Panel auto-runs on mount | Shows `X/Y generated rules proven to block their attack` |
| 3 | Each finding row | "Rule proven to block attack ✓" (green) or "Not proven ✗" (red) |
| 4 | Click "Re-run proof" | Re-fetches from `/api/aegis/verify-closed-loop?scanId=...` |
| 5 | Check Supabase `aegis_rules.verified_blocks_attack` | `true` persisted for proven rules |
| 6 | Hit the API as **non-owner** | **404** (no existence leak) |
| 7 | Confirm **no live target** is contacted | Proof is local/deterministic (check engine logs — no outbound scan traffic) |

---

## D6 — CI / build / deploys

| # | Check | PASS signal |
|---|-------|-------------|
| 1 | `npm run build` in `forgeguard-ai` | **PASS** (no type errors from new Aegis code) |
| 2 | `forgeguard-ai` `.github/workflows/ci.yml` | Green check on GitHub `main` |
| 3 | `AI-red-team` `.github/workflows/ci.yml` | Green check on GitHub `main` |
| 4 | `pytest tests/test_health.py` in AI-red-team | All tests pass (health, auth, SSRF) |
| 5 | Vercel prod deploy | Green, matches latest `main` SHA |
| 6 | Railway engine `curl https://engine.forgeguard-ai.com/health` | `{"status":"healthy",...}` |
| 7 | Supabase migration `20260704_aegis_closed_loop.sql` | `aegis_rules` has `verified_blocks_attack` + `cloudflare_rule_id` columns live |

---

## Rollback / known blockers

- **OpenRouter credits:** any live scan (D4 step 1–3, D5) needs OpenRouter
  balance. Recharge before running scan-dependent checks.
- **QR invalid:** if D3 step 4 still shows "invalid QR", confirm the modal is
  rendering the `tron:`-prefixed URI (see `CRYPTO_CHECKOUT_FIX.md`) and that
  `is_fixed_rate:false` is set on the NOWPayments request.
- **Migration missing live:** if D6 step 7 fails, re-apply
  `20260704_aegis_closed_loop.sql` via Supabase MCP.

## Sign-off

- [ ] D1 tenant isolation
- [ ] D2 sovereign / admin
- [ ] D3 billing crypto
- [ ] D4 scope + audit
- [ ] D5 Aegis closed-loop
- [ ] D6 CI / build / deploys

**Demo-ready only when all six are checked.**
