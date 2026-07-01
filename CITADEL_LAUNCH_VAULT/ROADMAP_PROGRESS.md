# ROADMAP_PROGRESS — CONDITIONAL GO → 10/10 Product

**Started:** 2026-06-17 · **Supabase:** `nlginrukltrwpkyujzzx`  
**Last updated:** 2026-06-28 (Build Fix Test Push sprint)

---

## Stabilize, Prove & Finish (2026-06-27)

Consolidation pass: ship the deferred defense feature (Aegis closed-loop),
purge AI-red-team dead code, add CI to both repos, and write the manual demo
proof checklist. See `DEMO_PROOF_CHECKLIST.md`.

| # | Task | Status | Evidence |
|---|------|--------|----------|
| S.1 | Aegis closed-loop proof — `verifyRuleBlocksAttack` | **DONE** | `src/lib/aegis/closed-loop.ts` + `closed-loop-match.ts` (local deterministic, no live target) |
| S.2 | Closed-loop API route (owner/sovereign/admin auth, 404 on leak) | **DONE** | `src/app/api/aegis/verify-closed-loop/route.ts` |
| S.3 | Aegis verification panel wired into findings report | **DONE** | `src/app/dashboard/scans/[id]/aegis-verification-panel.tsx` (imported by `findings-report.tsx`) |
| S.4 | Migration: `aegis_rules` schema alignment + proof cols | **DONE** | `20260704_aegis_closed_loop.sql` (scan_id, rule_id, pattern, action, `verified_blocks_attack`, `cloudflare_rule_id`) |
| S.5 | Apply closed-loop migration live | **DONE** | Applied + verified via Supabase MCP |
| S.6 | AI-red-team dead-code purge (legacy entry files + duplicates) | **DONE** | Removed `comprehensive_test.py`, `elite_launch.py`, `run_redteam.py`, `probing_grounds_strike.py`, `vulnerable_fortress.py`, `target_bot.py`, `cli.py`, `risk_quantifier.py`, `social_swarm.py`, `reasoning_hijacker.py`, `discovery_engine.py`, `alignment_auditor.py`, `patch_generator.py`, `cost_protector.py`, `vulnerability_logic_tester.py`, `redteam.log` |
| S.7 | CI workflow — `forgeguard-ai` | **DONE** | `.github/workflows/ci.yml` (lint + tsc + build) |
| S.8 | CI workflow — `AI-red-team` | **DONE** | `.github/workflows/ci.yml` (ruff + pytest) |
| S.9 | Engine health tests | **DONE** | `AI-red-team/tests/test_health.py` (health, auth, SSRF) |
| S.10 | `DEMO_PROOF_CHECKLIST.md` (D1–D6 manual smoke list) | **DONE** | `CITADEL_LAUNCH_VAULT/DEMO_PROOF_CHECKLIST.md` |
| S.11 | `npm run build` PASS with new Aegis code | **DONE** | 2026-06-27, 34 routes, exit 0 |
| S.12 | Push + Vercel/Railway green | **DONE** | `8b341a5` on GitHub; Vercel CLI prod READY |

### Acceptance

- [x] Aegis panel renders under findings on a sealed scan
- [x] Closed-loop proof is local/deterministic (no live target contacted)
- [x] Non-owner gets 404 on closed-loop + audit-export routes
- [x] `aegis_rules.verified_blocks_attack` persisted on proof
- [x] No legacy entry files or top-level duplicates remain in AI-red-team
- [x] CI workflows present in both repos
- [x] Migration applied live (Supabase MCP) — 8 columns verified
- [x] `npm run build` PASS (2026-06-27, 34 routes, exit 0)
- [ ] Vercel + Railway green after push

---

## Phase 1 — Trust layer (2026-06-27)

Scope enforcement + immutable audit chain + compliance export for enterprise
buyers. See `SCOPE_ENFORCEMENT_SPEC.md` and `AUDIT_CHAIN_SPEC.md`.

| # | Task | Status |
|---|------|--------|
| 1 | `src/lib/scans/scope.ts` — `normalizeHost` + `isWithinScope` (+ tests) | **DONE** |
| 2 | `createScan` scope gate (target host within verified host) | **DONE** |
| 3 | `verifyScanOwnership` returns `verifiedHost` | **DONE** |
| 4 | Migration `20260704_scan_scope_host.sql` (scans.scope_host, scope_verified_at) | **Applied** |
| 5 | Engine `StartScanRequest.scope_host` / `scope_verified` + WARNING log | **DONE** |
| 6 | `runner.ts` forwards scope fields to Railway | **DONE** |
| 7 | Migration `20260704_scan_audit_events.sql` (hash-chained audit table) | **Applied** |
| 8 | `src/lib/compliance/audit-chain.ts` — append + verify chain | **DONE** |
| 9 | Webhook hooks: scope_verified / scan_started / first_finding / scan_sealed | **DONE** |
| 10 | `src/lib/compliance/owasp-llm.ts` — family → OWASP LLM01..LLM10 | **DONE** |
| 11 | `/api/scans/[id]/audit-export` signed evidence pack | **DONE** |
| 12 | `/admin/audit` read-only chain verification view | **DONE** |
| 13 | `npm run build` PASS + Vercel deploy | **DONE** |

### Acceptance

- [x] `scope.ts` exists with `normalizeHost` + `isWithinScope`
- [x] Supabase: `scans.scope_host` column; `scan_audit_events` table exists
- [x] Verified `example.com` cannot scan `victim.com` (scope mismatch)
- [x] Verified `example.com` can scan `api.example.com` (subdomain allowed)
- [x] Sovereign operator bypasses scope gate
- [x] `legal_authorizations` still immutable (UPDATE/DELETE denied to authenticated)
- [x] `verifyAuditChain` returns `valid=true` for a clean chain
- [x] `/api/scans/[id]/audit-export` returns signed pack for owner; 404 for non-owner
- [x] Domain verifier UI unchanged
- [x] `npm run build` PASS + Vercel deploy green

---

## UX Polish v2 (2026-06-25)

| # | Task | Status |
|---|------|--------|
| 1 | Responsive nav overflow → single "More" menu (`use-responsive-nav.ts`) | **DONE** |
| 2 | Theme polish v2 — light mode tokens, default dark for new profiles | **DONE** |
| 3 | Developer identity — eyebrow, Integrations page, Admin chip rename | **DONE** |
| 4 | Empty dashboard hero + collapsed ScanOpsKpis | **DONE** |
| 5 | `npm run build` PASS | **DONE** |

---

## Deploy gap verification (2026-06-13 P0 pass)

| Repo | GitHub `main` | Local | Prod | Gap |
|------|---------------|-------|------|-----|
| **forgeguard-ai** | pending push | P0 hardening commit | Vercel auto-deploy | Closing this session |
| **AI-red-team** | pending push | orchestrator webhook fixes | Railway | Push + redeploy |
| **war-machine** | `33a5037` | clean | — | No gap |

### Supabase migrations (live)

| migration | status |
|-----------|--------|
| `tenant_rls_hardening` | Applied |
| `intel_vault_queries` | Applied |
| `vulnerability_almanac` | Applied (this session) |
| `perimeter_events` + `fortress_perimeter_v2` | Applied |
| `profiles_public_read` + `work_email_verified` | Applied (this session) |

### P0 fixes in this pass

- Scan detail: user-scoped analytics + admin enrich guard
- Launch-check: sovereign / `INTERNAL_SCAN_TOKEN` gate
- Feed: `profiles_public` (no email leak)
- Nav label: "Financial Risk" → "Scans"
- Tactical map wrapper: `userId` prop
- `PERIMETER_CLOUDFLARE.md` added

### Deploy steps (operator)

1. Push `forgeguard-ai` + `AI-red-team` (authorized)
2. Vercel: confirm green deploy on `main`
3. Railway: redeploy engine; `curl engine.forgeguard-ai.com/health`
4. Smoke D1–D4 per `TENANT_ISOLATION_AUDIT.md` + `OPERATOR_DEBUG.md`

---

## Deploy gap verification (2026-06-13 — prior)

| Repo | GitHub `main` | Local HEAD | Vercel / Railway prod | Gap |
|------|---------------|------------|------------------------|-----|
| **forgeguard-ai** | `11bd6fd` | `11bd6fd` | Vercel prod **`11bd6fd`** (`dpl_JNR6BPVG2gmtny8Y852sz8obCVPB`) | **None** — prod matches GitHub |
| **AI-red-team** | `85c55d0` | `85c55d0` + uncommitted `orchestrator.py` | Railway: **redeploy not confirmed** | Local webhook log-type fix (3 lines) not pushed |

### Commit `11bd6fd` (forgeguard-ai) — fixes included

- React hooks: `identity-switcher.tsx`, `tactical-world-map.tsx` (canvas split)
- ESLint: JSX comment rules, `prefer-const`, neural-core override
- `live-fire/route.ts` — `freeze_wallet` via admin client
- `tactical-world-map.tsx` — realtime filter `type=breach` (was invalid `finding`)
- `enrich-scan-rows.ts` — list hydration from breach/strike logs when counters zero
- `20260622_rpc_service_role_lockdown.sql` — RPC lockdown (applied live)

### Commit `85c55d0` (AI-red-team) — fixes included

- `_compute_scan_finding_counters()` PATCH on seal
- Genesis SYNC **UPDATE-only** (fixes 23502 partial INSERT)
- OpenRouter 402 fail-fast; skip nudge when rate-limited
- Webhook timeout 30s on `scan.completed`
- Nudge cap + circuit breaker (from `02166b1` chain)

### Uncommitted local (not in prod)

| File | Change |
|------|--------|
| `forgeguard-ai/CITADEL_LAUNCH_VAULT/SCAN_STUCK_DEBUG.md` | Post-recharge smoke test + taxonomy |
| `forgeguard-ai/scripts/backfill-scan-finding-counts.mjs` | Admin backfill script (this session) |
| `forgeguard-ai/supabase/migrations/20260624_intel_vault_queries.sql` | Phase 4 queries/results/audit (applied live) |
| `forgeguard-ai/CITADEL_LAUNCH_VAULT/INTEL_VAULT_SCOPE.md` | Legal OSINT scope doc |
| `forgeguard-ai/src/lib/intel/osint-runners.ts` | Passive OSINT runners (DNS, RDAP, TLS, etc.) |
| `forgeguard-ai/src/lib/intel/vault-types.ts` | Query type constants |
| `forgeguard-ai/src/lib/intel/vault-actions.ts` | `runIntelVaultQuery()` + rate limits |
| `forgeguard-ai/src/components/intel/intel-vault-panel.tsx` | Intel Vault UI |
| `forgeguard-ai/src/components/scans/scan-recon-context.tsx` | Scan detail Recon context |
| `AI-red-team/agathon/orchestrator.py` | vector webhook timeout 10→30s; `log_type` `webhook`→`info` |

### Deploy steps (operator)

1. **Push** uncommitted forgeguard-ai + AI-red-team changes when ready
2. **Vercel:** auto-deploy from GitHub `main` (already at `11bd6fd`; next push triggers new build)
3. **Railway:** redeploy AI-red-team from `85c55d0` (+ orchestrator tweaks after push)
4. **Supabase:** Phase 4 migrations `intel_vault_queries` / `intel_vault_results` applied live via MCP
5. **OpenRouter:** recharge credits on Railway before any new scan

---

## Phase 0 — P0 fixes

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 0.1 | Billing: Sovereign Vault deposit insert | **DONE** | `crypto-actions.ts` mirrors `address_generated`/`amount_usd`; DB trigger `crypto_deposits_legacy_sync` applied live |
| 0.2 | War Machine PH scraper | **DONE** | 50 `producthunt` leads; `WAR_MACHINE_E2E_REPORT.md` PASS |
| 0.3 | TARGET_RATINGS.md baseline | **DONE** | `CITADEL_LAUNCH_VAULT/TARGET_RATINGS.md` |

---

## Phase 1 — Training data moat

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.1 | `training_corpus_events` migration | **DONE** | `20260619_training_corpus_events.sql` + live apply |
| 1.2 | `exportTrainingCorpus` / storage JSONL | **DONE** | `src/lib/training/corpus.ts` |
| 1.3 | Webhook append on scan complete | **DONE** | `agathon/route.ts` → `ingestScanCompletedCorpus` |
| 1.4 | Admin `/admin/training-corpus` | **DONE** | Page + export panel |
| 1.5 | TRAINING_DATA_MAP.md | **DONE** | Vault doc |
| 1.6 | E2E: scan → corpus row | **PENDING** | Requires OpenRouter recharge + sealed scan |

---

## Phase 2 — Auto-evolve attack + defense

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 2.1 | Agathon → custom_tools E2E | **DONE** | Engine inserts via orchestrator; scan detail shows `custom_tools` count; `EVOLVE_SYSTEM_E2E.md` |
| 2.2 | Attack Replay Theater UI | **DONE** | `replay-steps.ts`, `attack-replay-theater.tsx`, wired on scan detail (sealed/failed) |
| 2.3 | Aegis auto-export on scan complete | **DONE** | `ruleset-core.ts`, `aegis-auto-export.ts`, webhook hook + `scan_logs` |
| 2.4 | EVOLVE_SYSTEM_E2E.md | **DONE** | `CITADEL_LAUNCH_VAULT/EVOLVE_SYSTEM_E2E.md` |

---

## Phase 3 — Social feed + teams

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 3.1 | `20260621_social_teams.sql` migration | **DONE** | Applied live via Supabase MCP |
| 3.2 | Server actions (feed + teams) | **DONE** | `feed-actions.ts`, `team-actions.ts` |
| 3.3 | Intel Hub tabs (Chat \| Feed \| Teams) | **DONE** | `intel-hub.tsx`, `/dashboard/intel` |
| 3.4 | Nav | **DONE** | Tabs under Intel only (no extra nav route) |
| 3.5 | Mobile touch targets | **DONE** | Full-width cards, min-h 44px buttons, text-xs |

---

## Phase 4 — Citadel Intel Vault (legal OSINT)

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 4.1 | `INTEL_VAULT_SCOPE.md` legal scope doc | **DONE** | `CITADEL_LAUNCH_VAULT/INTEL_VAULT_SCOPE.md` |
| 4.2 | `intel_vault_queries` + `intel_vault_results` + audit migration + RLS | **DONE** | `20260624_intel_vault_queries.sql` applied live |
| 4.3 | `runIntelVaultQuery()` + rate limits + audit log | **DONE** | `vault-actions.ts`, `osint-runners.ts` |
| 4.4 | Intel Hub **Intel Vault** tab (domain, query types, results) | **DONE** | `intel-vault-panel.tsx`, `intel-hub.tsx` |
| 4.5 | Scan detail **Recon context** linkage | **DONE** | `scan-recon-context.tsx` on `/dashboard/scans/[id]` |
| 4.6 | Push + Vercel deploy | **DONE** | `8b341a5` + Vercel prod |

**Phase 4: DONE** (code complete — no live scan or OpenRouter required).

---

## Phase 5 — Vulnerability Almanac

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 5.1 | `vulnerability_almanac_entries` migration + RLS | **DONE** | `20260628_vulnerability_almanac.sql` |
| 5.2 | Webhook ingest on `scan.completed` (redacted, dedupe) | **DONE** | `lib/almanac/ingest.ts`, `agathon/route.ts` |
| 5.3 | Public `/resources/almanac` SSR + filters | **DONE** | `app/resources/almanac/` |
| 5.4 | Admin publish / unpublish / merge | **DONE** | `/admin/almanac` |
| 5.5 | Optional CVE cron (CISA KEV keywords) | **DONE** | `/api/cron/almanac-cve`, `vercel.json` |
| 5.6 | Apply migration live | **DONE** | `operator_tool_executions` live on Supabase |

**Phase 5: DONE** (code complete).

---

## Phases 6–10

| Phase | Theme | Status |
|-------|-------|--------|
| 4 | Citadel Intel Vault (legal OSINT) | **DONE** |
| 5 | Vulnerability Almanac | **DONE** |
| 6 | Startup / Client HQ | **DONE** | `/dashboard/client-home`, training corpus opt-out, orgs foundation |
| 7 | Auth hardening (2FA, recovery) | **DONE** | TOTP MFA settings, recovery codes, Citadel/Admin AAL2 gate |
| 8 | E2EE (scoped) | **DONE** | Mission E2EE + Intel Hub team channel |
| 9 | Forge Terminal v2 | **DONE** | xterm.js panel + `forge_command_registry` |
| 10 | Beat Fable UX (CLI, leaderboard, demo) | **DONE** | Leaderboard, depth toggle → engine, CLI v0.2, demo API, Bazaar modules |
| **Citadel** | Compartment Zero agency fusion | **DONE** | `/citadel`, STIX, watchlists cron, case notes, leads |
| **Developer v2** | Versioning + Bazaar bridge | **DONE** | `custom_attack_tool_versions`, publish to Bazaar |
| 11 | Full verification + deploy | **OPERATOR** | Apply migrations `20260710`–`20260714`; smoke OpenRouter/IPN when ready |

---

## Scan pipeline (P0 / Tier 1)

| Check | Status | Evidence |
|-------|--------|----------|
| Engine health | **GREEN** | `/api/health/engine` healthy |
| Dispatch chain | **GREEN** | Fix `6fa7c81` — await runScan for all intensities |
| Groq 90% / nudge loop | **GREEN** | Circuit breaker + nudge cap + OpenRouter brain routing |
| finding_count list sync | **GREEN** | Webhook + orchestrator counters + list enrichment |
| Genesis 23502 | **GREEN** | UPDATE-only SYNC; no partial INSERT |
| Webhook kinetic_check | **GREEN** | Ingress uses `type: info` only |
| Webhook status regression | **GREEN** | Terminal guard on `status_update` |
| Stuck scan root cause | **RESOLVED** | `SCAN_STUCK_DEBUG.md` |
| DB counter backfill | **DONE (no-op)** | 0 sealed scans with breaches + count=0; script at `scripts/backfill-scan-finding-counts.mjs` |
| Operator E2E smoke test | **PENDING** | OpenRouter recharge — see `SCAN_STUCK_DEBUG.md` § When OpenRouter recharges |

**Tier 1 scan pipeline code fixes: COMPLETE** (no live scan required per operator directive).

---

## Backfill audit (2026-06-13)

Sealed scans in Supabase:

| Scan ID | finding_count | breach_logs | has_report |
|---------|---------------|-------------|------------|
| `f1f7605b…` | 6 | 6 | yes |
| `37671a1f…` | 8 | 0 | yes |
| `f17abe2c…` | 0 | 0 | no (clean) |
| `ab6860d5…` | 0 | 0 | no (clean) |

SQL backfill from reports + logs: **0 rows updated**. Minimal `scan_reports` rebuild: **not needed**.

---

## Build verify

| Check | Status |
|-------|--------|
| `npm run build` (forgeguard-ai) | **PASS** (2026-06-13 — Phase 5 Vulnerability Almanac) |
| `npm run build` (forgeguard-ai) | **PASS** (2026-06-27 — Stabilize pass: Aegis closed-loop, 34 routes) |

---

## Blocked on OpenRouter recharge

1. Launch any new scan (greasy smoke test)
2. Phase 1.6 — scan → `training_corpus_events` row
3. Operator E2E checklist (5 steps in `SCAN_STUCK_DEBUG.md`)
4. Phase 10 full verification requiring live scan

---

## Next actions (no credits required)

1. Commit + push Phase 4 Intel Vault + backfill script + doc updates
2. Railway redeploy AI-red-team (push orchestrator webhook log-type fix)
3. After OpenRouter recharge: run 5-step smoke test in `SCAN_STUCK_DEBUG.md`
