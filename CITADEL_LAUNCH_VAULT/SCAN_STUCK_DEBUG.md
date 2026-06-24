# SCAN_STUCK_DEBUG — P0 Pipeline Fix

**Date:** 2026-06-21 · **Supabase:** `nlginrukltrwpkyujzzx`  
**Commits:** forgeguard-ai `11bd6fd` · AI-red-team `85c55d0`

---

## Symptom

User launches attack/scan → UI stuck at **Queued** or **Probing**, never seals.

---

## Phase A — Classification

### Health probes (PASS)

| Check | Result |
|-------|--------|
| `GET /api/debug/launch-check` | `ok: true`, `engineProbe.ok: true`, latency ~188ms |
| `GET /api/health/engine` | `status: healthy`, Agathon-Sovereign, registry 161 |
| Env matrix | All required vars set (PYTHON_ENGINE_URL, INTERNAL_SCAN_TOKEN, SCAN_CREDENTIAL_SECRET) |
| Webhook auth | `POST /api/v1/webhooks/agathon` empty body → **401** (expected) |

### Stuck scans in Supabase

| scan_id | status | intensity | progress | logs | created_at |
|---------|--------|-----------|----------|------|------------|
| `20191b6d-0fb3-4f10-bcf4-6b7fe59c5771` | **queued** | **greasy** | 0 | **0** | 2026-06-19 22:19 |
| `0226cfb7-74f3-4a83-b0c3-0ab2655272c6` | **queued** | **aggressive** | 0 | **0** | 2026-06-19 21:32 |

Successful historical scans (standard intensity) sealed normally with logs.

**Classification: STUCK_QUEUED** — never left `queued`, zero `scan_logs`, both high-intensity.

Not STUCK_UI_ONLY (DB also shows queued). Not orchestrator hang (never dispatched).

---

## Phase B — Root cause

### Dispatch chain

```
createScan (actions.ts)
  → POST /api/scan/start
    → launchScan (scan-launcher.service.ts)
      → runScan (runner.ts) → POST {PYTHON_ENGINE_URL}/scan/start
        → Railway orchestrator asyncio.create_task(run_scan)
```

### Bug

In `scan-launcher.service.ts`, **greasy** and **aggressive** intensities used **fire-and-forget**:

```typescript
void runScan({ scanId, userId }).then(...).catch(...);
return { ok: true, message: "Runner dispatched (non-blocking high-intensity)" };
```

On **Vercel serverless**, the function terminates when the HTTP response is sent. The unawaited `runScan()` promise is **killed before** it can:

1. Transition scan → `probing`
2. POST to Railway `/scan/start`
3. Insert any `scan_logs`

Result: scan stays `queued` at 0% with **zero logs** forever.

**Standard intensity worked** because it `await runScan()`.

Secondary issue: `createScan` **swallowed** dispatch errors in a catch block and redirected anyway, leaving orphaned `queued` rows on timeout.

---

## Phase C — Railway orchestrator

- `/scan/start` accepts and spawns `asyncio.create_task(run_scan)` — correct
- `run_scan` has try/except + always updates status to sealed/failed at end — OK
- Engine health green; not the bottleneck for these stuck scans

---

## Phase D — Webhook & UI

- `scan-status-tracker.tsx` already polls every 5s during queued/probing — OK
- UI was accurate; DB genuinely stuck at queued

---

## Phase E — Fixes applied

| File | Change |
|------|--------|
| `scan-launcher.service.ts` | **Always `await runScan()`** — remove high-intensity fire-and-forget |
| `actions.ts` | On dispatch failure/timeout → `markScanDispatchFailed()` (failed + dispatch_error log), surface error to user |
| `runner.ts` | Add `scan_id` to error logs |

---

## Phase F — Verification

### Build

- [x] `npm run build` PASS
- [x] Vercel prod deploy → [forgeguard-ai.com](https://forgeguard-ai.com) (`6fa7c81`)

### E2E (post-deploy)

1. Launch **standard** intensity scan against Groq `llama-3.1-8b-instant` @ `https://api.groq.com/openai/v1`
2. Expect: queued → probing (≤5s) → progress increases → sealed
3. Launch **greasy** scan — must leave queued within seconds (logs appear)

**Evidence:** Prior standard scans sealed (`37671a1f`, `ab6860d5`, `f17abe2c`). Engine probe 200ms. Stuck greasy/aggressive rows had 0 logs pre-fix; marked failed with reason. Fix removes fire-and-forget — operator should launch fresh scan to confirm greasy path.

### Stuck scan recovery

Pre-fix rows `20191b6d`, `0226cfb7` marked **failed** with recovery message. Delete or launch new scan.

---

## Plain-English summary

**Greasy and aggressive scans never actually started.** The app told Vercel "done" before sending the scan to Railway, and Vercel killed the background work. Standard scans worked fine. Fix: always wait for the Railway handshake to finish before responding.

---

## Incident 2 — STUCK_PROBING_90_GROQ_429

**Date:** 2026-06-19 · **Scan:** `ec97f348-4ba1-458d-aee4-cc3e1a1a2ee8` · **Commits:** AI-red-team `02166b1`, forgeguard-ai `df6b891`

### Classification

| Signal | Evidence |
|--------|----------|
| Progress | Frozen at **90%**, status **probing** |
| Groq | `429 rate_limit_exceeded` — ~2.3K calls/24h free tier |
| Live log loop | `brain returned no tool calls — injecting nudge` |
| Groq-on-Groq | Target `api.groq.com` + Brain uses same `GROQ_API_KEY` |
| UI regression | Late `status_update` webhook **downgraded** sealed → probing after `scan.completed` |

### Root cause

1. Brain progress caps at ~90% until `seal_scan` — normal, not a hang by itself.
2. Groq free-tier exhaustion → Brain returns empty tool_calls → infinite nudge loop.
3. Same API key for target strikes + Brain doubles rate pressure.
4. `status_update` webhook had no terminal guard — progress ping after completion reset status to probing (scan `ec97f348` had `scan_reports` + `completed_at` but UI showed probing).

### Fixes

| Component | Change |
|-----------|--------|
| `orchestrator.py` | `consecutive_no_tool_calls` — force exit after 5 nudges (`brain_stuck_no_tools`) |
| `orchestrator.py` | Rate-limit circuit breaker at 8 hits → fail with readable message |
| `orchestrator.py` | Groq target → prefer `OPENROUTER_API_KEY` for Brain (`deepseek/deepseek-chat`) |
| `orchestrator.py` | `MAX_BRAIN_TURNS` 20 on Groq free tier when no OpenRouter |
| `agathon/route.ts` | Skip `status_update` when scan already sealed/failed |
| `scan-status-tracker.tsx` | 90% probing banner (not stuck; Groq 429 guidance) |

### Operator playbook

1. **Cooldown** ~60 minutes after Groq 429, or upgrade Groq Dev tier.
2. Set **`OPENROUTER_API_KEY`** on Railway AI-red-team (Brain uses OpenRouter; strikes use target key).
3. Use **non-Groq target** for smoke tests when Groq quota is hot.
4. PASS criteria: scan **seals or fails fast** within 15m — never infinite 90% + nudge loop.

### Recovery

- `ec97f348` manually reconciled to **sealed** (report existed; webhook downgrade bug).

---

## Incident 3 — LIST_ZERO_DETAIL_N + REPORT_23502 + kinetic_check

**Classification codes:** `LIST_ZERO_DETAIL_N`, `REPORT_23502`, `STUCK_PROBING_90_GROQ_429`

### Symptoms

| Error | Meaning |
|-------|---------|
| `scan_logs_type_kinetic_check` | Vercel webhook inserted `type: "webhook"` — not in production CHECK |
| `23502` NOT NULL | Genesis SYNC partial upsert without `executive_summary_md` |
| List **0 findings**, detail **5 HIGH** | `scans.finding_count` never updated on `scan.completed` |
| `webhook_notify_failed` timeout | Engine POST timeout 10s; Vercel handler slow |

### Fixes (this session)

| P0 | File | Change |
|----|------|--------|
| 1 | `webhooks/agathon/route.ts` | Sync `finding_count` / `high_severity_count` on seal; backfill findings from scan_logs |
| 1 | `orchestrator.py` | `_compute_scan_finding_counters` on scan PATCH before webhook |
| 2 | `orchestrator.py` | Genesis SYNC **UPDATE-only** when row exists (no partial INSERT) |
| 3 | `webhooks/agathon/route.ts` | Ingress log `type: "info"` only (no duplicate fallback) |
| 4 | `orchestrator.py` | Skip nudge when rate limited; OpenRouter 402 fail-fast; webhook timeout 30s |
| 5 | `finding-counts.ts` + webhook | Backfill empty findings from breach logs |
| 6 | `scans/page.tsx` + `enrich-scan-rows.ts` | List hydrates counts from `scan_reports` when stale |
| 6 | `scans/[id]/page.tsx` | Banner when report missing but breach logs exist |

### SQL verification

```sql
SELECT s.id, s.status, s.finding_count, s.high_severity_count,
       jsonb_array_length(sr.findings) AS report_findings
FROM scans s
LEFT JOIN scan_reports sr ON sr.scan_id = s.id
WHERE s.id = '<scan_id>';
```

```sql
SELECT type, severity, attack_name, payload->>'message' AS msg
FROM scan_logs WHERE scan_id = '<scan_id>'
ORDER BY created_at DESC LIMIT 20;
```

### Operator playbook

1. Top up **OpenRouter** credits on Railway AI-red-team.
2. Keep **Groq target key** separate from engine `GROQ_API_KEY`.
3. After Groq 429: **60m cooldown** or upgrade tier before `gpt-oss-*` targets.
4. Smoke target matrix: OpenAI `gpt-4o-mini`, or Groq only after cooldown + OpenRouter brain set.
5. Redeploy **both** Railway (`AI-red-team`) and Vercel (`forgeguard-ai`).

### Allowed scan_logs types (production)

From `20260607_emergency_brain_reset.sql` + kinetic migration: `info`, `thought`, `strike`, `breach`, `finance` (and legacy expanded set if applied). **Always use `info` for webhook ingress.**

---

## Error taxonomy (quick reference)

| Code | Symptom | Root cause | Fix location |
|------|---------|------------|--------------|
| `STUCK_QUEUED` | status=queued, 0 logs, greasy/aggressive | Vercel fire-and-forget `runScan()` | `scan-launcher.service.ts` |
| `STUCK_PROBING_90_GROQ_429` | 90% probing, nudge loop, Groq 429 | Brain+target share quota; no tool calls | `orchestrator.py` nudge cap + OpenRouter brain |
| `LIST_ZERO_DETAIL_N` | List 0 findings, detail shows breaches | `scans.finding_count` not synced on seal | webhook + orchestrator PATCH |
| `REPORT_23502` | `[SYNC] Supabase sync failed: 23502` | Genesis partial INSERT missing NOT NULL cols | Genesis UPDATE-only SYNC |
| `KINETIC_CHECK` | `scan_logs_type_kinetic_check` in Vercel logs | Ingress used `type: "webhook"` | webhook `type: "info"` |
| `WEBHOOK_DOWNGRADE` | Sealed scan reverts to probing | Late `status_update` after seal | webhook terminal guard |
| `WEBHOOK_TIMEOUT` | `webhook_notify_failed` in engine logs | POST timeout too short | `_notify_agathon_webhook` timeout 30s |

---

## When OpenRouter recharges — 5-step smoke test

Run only after **OpenRouter credits are live** on Railway (`OPENROUTER_API_KEY`) and both stacks are redeployed.

1. **Preflight** — `GET https://forgeguard-ai.com/api/debug/launch-check` → `engineProbe.ok: true`, `openrouter: true`.
2. **Launch standard scan** — non-Groq target (e.g. OpenAI `gpt-4o-mini`) OR Groq target only after 60m cooldown with OpenRouter brain set on Railway.
3. **Timeline** — queued → probing within 5s → progress increases → **sealed or failed within 15m** (never infinite 90% + nudge loop).
4. **Data parity** — list grid `finding_count` matches detail breakdown; Enterprise Report + PDF visible on sealed scan.
5. **Log hygiene** — no `scan_logs_type_kinetic_check` in Vercel logs; no `[SYNC] 23502` on new scans; `failure_reason` readable if failed (e.g. rate limit circuit breaker).

### Pass / fail SQL

```sql
-- Replace <scan_id> after smoke run
SELECT s.id, s.status, s.progress_pct, s.finding_count, s.high_severity_count,
       s.failure_reason, sr.scan_id IS NOT NULL AS has_report,
       jsonb_array_length(COALESCE(sr.findings, '[]'::jsonb)) AS report_findings
FROM scans s
LEFT JOIN scan_reports sr ON sr.scan_id = s.id
WHERE s.id = '<scan_id>';
```

```sql
SELECT type, severity, attack_name, left(payload::text, 120) AS payload_preview
FROM scan_logs WHERE scan_id = '<scan_id>'
ORDER BY created_at DESC LIMIT 25;
```
