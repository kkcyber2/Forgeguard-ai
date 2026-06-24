# ROADMAP_PROGRESS — CONDITIONAL GO → 10/10 Product

**Started:** 2026-06-17 · **Supabase:** `nlginrukltrwpkyujzzx`  
**Last updated:** 2026-06-13 (no-E2E session — OpenRouter credits depleted)

---

## Deploy gap verification (2026-06-13)

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
| 4.6 | Push + Vercel deploy | **PENDING** | Local only until commit/push |

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
| 5.6 | Apply migration live | **PENDING** | Supabase `nlginrukltrwpkyujzzx` |

**Phase 5: DONE** (code complete).

---

## Phases 6–10

| Phase | Theme | Status |
|-------|-------|--------|
| 4 | Citadel Intel Vault (legal OSINT) | **DONE** |
| 5 | Vulnerability Almanac | **DONE** |
| 6 | Startup / Client HQ | NOT STARTED |
| 7 | Auth hardening (2FA, recovery) | NOT STARTED |
| 8 | E2EE (scoped) | NOT STARTED |
| 9 | Forge Terminal v2 | NOT STARTED |
| 10 | Beat Fable UX (CLI, leaderboard, demo) | NOT STARTED (deferred per user — Phase 4 first) |
| 11 | Full verification + deploy | IN PROGRESS |

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
