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

| # | Task | Status |
|---|------|--------|
| 2.1 | Agathon → custom_tools E2E | PENDING |
| 2.2 | Attack Replay Theater UI | PENDING |
| 2.3 | Aegis export → persist rules | PENDING |
| 2.4 | EVOLVE_SYSTEM_E2E.md | PENDING |

---

## Phases 3–10

| Phase | Theme | Status |
|-------|-------|--------|
| 3 | Social feed + teams | NOT STARTED |
| 4 | Citadel Intel Vault (legal OSINT) | NOT STARTED |
| 5 | Startup / Client HQ | NOT STARTED |
| 6 | Auth hardening (2FA, recovery) | NOT STARTED |
| 7 | E2EE (scoped) | NOT STARTED |
| 8 | Forge Terminal v2 | NOT STARTED |
| 9 | Beat Fable UX (CLI, leaderboard, demo) | NOT STARTED |
| 10 | Full verification + deploy | PENDING build |

---

## Next actions

1. `npm run build` — verify Phase 0 + 1 compile  
2. Deploy forgeguard-ai to Vercel prod  
3. Operator: Billing → Sovereign 199 USDT → confirm `crypto_deposits` pending row  
4. Run one scan → confirm `training_corpus_events` row  
5. Begin Phase 2 E2E doc
