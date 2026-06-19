# ROADMAP_PROGRESS — CONDITIONAL GO → 10/10 Product

**Started:** 2026-06-17 · **Supabase:** `nlginrukltrwpkyujzzx`

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
| 1.6 | E2E: scan → corpus row | **PENDING** | Requires next sealed scan in prod |

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

## Phases 4–10

| Phase | Theme | Status |
|-------|-------|--------|
| 4 | Citadel Intel Vault (legal OSINT) | NOT STARTED |
| 5 | Startup / Client HQ | NOT STARTED |
| 6 | Auth hardening (2FA, recovery) | NOT STARTED |
| 7 | E2EE (scoped) | NOT STARTED |
| 8 | Forge Terminal v2 | NOT STARTED |
| 9 | Beat Fable UX (CLI, leaderboard, demo) | NOT STARTED |
| 10 | Full verification + deploy | IN PROGRESS |

---

## Next actions

1. Operator: sealed scan → confirm `custom_tools`, `aegis_rules`, replay UI, `training_corpus_events`
2. Operator: `/dashboard/intel` → create post, create team, like post
3. Operator: Billing → Sovereign deposit → confirm `crypto_deposits` pending row
4. Begin Phase 4 (legal OSINT Intel Vault)
