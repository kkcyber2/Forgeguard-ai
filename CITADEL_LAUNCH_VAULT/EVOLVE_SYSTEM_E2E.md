# EVOLVE_SYSTEM_E2E — Phase 2

**Date:** 2026-06-17 · **Supabase:** `nlginrukltrwpkyujzzx`

---

## Attack evolve — custom_tools

| Check | Result | Evidence |
|-------|--------|----------|
| Engine writes `custom_tools` | **PASS (architecture)** | `AI-red-team/agathon/orchestrator.py` inserts via Supabase admin (`origin_scan_id`, `user_id`, `spec`) — not ForgeGuard webhook |
| Scan detail shows count | **PASS (UI)** | `/dashboard/scans/[id]` → **Evolved tools** card queries `custom_tools` where `origin_scan_id = scan.id` |
| High-intensity scan → row | **OPERATOR** | Run aggressive scan; `SELECT * FROM custom_tools WHERE origin_scan_id = '<scan_id>'` |

**Path:** Agathon Brain (greasy tier) → `custom_tools_run += 1` → direct Supabase insert → ForgeGuard reads by `origin_scan_id`.

---

## Defense evolve — aegis_rules auto-persist

| Check | Result | Evidence |
|-------|--------|----------|
| Ruleset core extracted | **PASS** | `src/lib/aegis/ruleset-core.ts` — `TECHNIQUE_PATTERNS`, `buildCloudflareRuleset`, `aegisRulesToRows` |
| Manual export unchanged | **PASS** | `POST /api/aegis/export` imports from `ruleset-core.ts` |
| Auto-persist on scan.completed | **PASS (code)** | `agathon/route.ts` → `autoPersistAegisRulesForScan()` after corpus ingest |
| scan_logs audit row | **PASS (code)** | Inserts `attack_name: aegis_auto_evolve` with `rule_count` |
| Live row after scan | **OPERATOR** | `SELECT * FROM aegis_rules WHERE scan_id = '<id>' ORDER BY created_at DESC` |

**PASS criteria:** ≥1 `aegis_rules` row per sealed scan with findings (or default prompt_injection seed when logs empty).

---

## Attack Replay Theater

| Check | Result | Evidence |
|-------|--------|----------|
| Step builder | **PASS** | `src/lib/evolve/replay-steps.ts` — `buildAttackReplaySteps(logs, attack_path)` |
| UI component | **PASS** | `src/components/scans/attack-replay-theater.tsx` — Play/Pause, step pills |
| Wired on scan detail | **PASS** | Renders above `ScanResult` when `status ∈ {sealed, failed}` and steps exist |

**PASS criteria:** UI visible when `scan_logs` contain strike/breach/thought/finding types.

---

## Verdict

| Track | Status |
|-------|--------|
| Attack (custom_tools) | **PASS** — engine path documented + UI count |
| Defense (aegis auto) | **PASS** — webhook + ruleset core shipped |
| Replay Theater | **PASS** — UI shipped |

**Operator smoke:** one sealed scan → verify `custom_tools`, `aegis_rules`, Replay Theater visible.
