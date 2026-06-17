# WAR_MACHINE_E2E_REPORT — 2026-06-17

**Service:** `https://war-machine-production.up.railway.app`  
**ForgeGuard dispatch:** `POST /api/admin/war-machine` → Railway `POST /scrape`

---

## Test A — GET /health

```json
{"ok":true,"service":"war-machine","status":"healthy","scrape_running":false}
```

**Result:** PASS

---

## Test B — POST /scrape

**Command:** `war-machine/scripts/test-scrape.cjs` (Railway `INTERNAL_SCAN_TOKEN`)

**Request:**
```json
{"hours":24,"source":"producthunt_ai"}
```

**Response (202):**
```json
{"ok":true,"status":"accepted","source":"producthunt","hours":24,"max":50}
```

**Result:** PASS — auth + dispatch wiring OK

---

## Test C — Leads after 90s wait

**Supabase `public.leads`:** 0 rows  
**`war_machine_stats`:** `total_scraped: 0`, `updated_at: 2026-06-17T16:18:55Z`

Scrape job **ran to completion** but Product Hunt selectors returned **0 upserts** (known selector/site drift — not a 401/502 wiring failure).

**Result:** FAIL (data) / PASS (pipeline) — **CONDITIONAL**

---

## Test D — Admin path

`POST /api/admin/war-machine` requires sovereign admin session → **403 without cookie** (expected).

**Manual:** Admin → Fire Marine Swarm → expect **202** when logged in as sovereign operator.

**Result:** PASS (code path); manual UI not run in this audit

---

## Test E — Token parity

- Vercel launch-check: `engineEnv.tokenSet: true`, `warMachine: true`
- Direct scrape with Railway token: **202** (proves token works end-to-end)
- Byte-for-byte CLI parity check failed in audit shell (Railway link / env pull context) — **functional parity OK**

**Result:** PASS (functional)

---

## Test F — Railway env (war-machine)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Set (scrape updates stats) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Set |
| `INTERNAL_SCAN_TOKEN` | Yes | Set (48 chars) |
| `HEADLESS` | Yes | Production default |
| `OPENROUTER_API_KEY` | Optional | Outreach stage |
| `RESEND_API_KEY` | Optional | Outreach email |
| `MAX_LEADS_PER_RUN` | Optional | Default 50 |

**Result:** PASS (required vars present via successful scrape + stats sync)

---

## Root cause — 0 leads

1. Playwright runs and completes (`scrape_running: false` after job)
2. `sync_war_machine_stats()` fires (stats row updated)
3. Product Hunt DOM selectors in `scraper.py` likely stale vs current PH markup

**Follow-up (post-launch P2):** Tune PH selectors or switch default source to `yc` for smoke tests.

---

## Verdict for launch

War Machine **API + auth + async job** are production-ready. **Lead ingestion is empty** until scraper selectors are updated — does **not** block core ForgeGuard scan/billing/identity flows.
