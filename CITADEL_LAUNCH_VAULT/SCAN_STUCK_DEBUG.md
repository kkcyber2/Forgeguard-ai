# SCAN_STUCK_DEBUG — P0 Pipeline Fix

**Date:** 2026-06-19 · **Supabase:** `nlginrukltrwpkyujzzx` · **Commit:** `6fa7c81`

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
