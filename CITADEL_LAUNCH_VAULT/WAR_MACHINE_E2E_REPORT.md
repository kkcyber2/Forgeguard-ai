# WAR_MACHINE_E2E_REPORT — 2026-06-17 (re-run after scraper fix)

**Service:** `https://war-machine-production.up.railway.app`  
**ForgeGuard dispatch:** `POST /api/admin/war-machine` → Railway `POST /scrape`  
**Supabase:** `nlginrukltrwpkyujzzx` · `public.leads` · `war_machine_stats`

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

## Test C — Leads after 120s wait

**Command:** `node war-machine/scripts/test-scrape.cjs` → wait 150s → Supabase SQL

**Results:**

| Check | Value |
|-------|-------|
| `SELECT count(*) FROM leads WHERE source='producthunt'` | **50** |
| `war_machine_stats.total_scraped` | **50** |
| `war_machine_stats.updated_at` | `2026-06-17T17:37:15Z` |

**Sample rows:**

| company_name | source | website_url | created_at |
|--------------|--------|-------------|------------|
| Granola | producthunt | https://www.producthunt.com/products/granola | 2026-06-17T17:37:15Z |
| Vapi | producthunt | https://www.producthunt.com/products/vapi | 2026-06-17T17:37:15Z |
| PostHog | producthunt | https://www.producthunt.com/products/posthog | 2026-06-17T17:37:15Z |
| Attio | producthunt | https://www.producthunt.com/products/attio | 2026-06-17T17:37:14Z |
| n8n | producthunt | https://www.producthunt.com/products/n8n-io | 2026-06-17T17:37:14Z |

**Result:** **PASS** (data + pipeline)

---

## Test D — Admin path

`POST /api/admin/war-machine` requires sovereign admin session → **403 without cookie** (expected).

**Manual:** Admin → Fire Marine Swarm → expect **202** when logged in as sovereign operator.

**Result:** PASS (code path); manual UI not run in this audit

---

## Test E — Token parity

- Vercel launch-check: `engineEnv.tokenSet: true`, `warMachine: true`
- Direct scrape with Railway token: **202** (proves token works end-to-end)

**Result:** PASS (functional)

---

## Test F — Railway env (war-machine)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Set |
| `INTERNAL_SCAN_TOKEN` | Yes | Set (48 chars) |
| `HEADLESS` | Yes | Production default |
| `OPENROUTER_API_KEY` | Optional | Outreach stage |
| `RESEND_API_KEY` | Optional | Outreach email |
| `MAX_LEADS_PER_RUN` | Optional | Default 50 |

**Result:** PASS

---

## Root cause — 0 leads (fixed)

1. **Product Hunt DOM drift:** PH moved from `/posts/{slug}` to `/products/{slug}`. Old scraper selector `a[href^="/posts/"]` returned 0 links.
2. **Fix:** List-page parsing via `a[href^="/products/"]`, anchor innerText for title/tagline, URL fallbacks (topic → daily leaderboard → homepage), consent dismissal, Cloudflare skip on detail pages.
3. **Secondary blockers (also fixed):**
   - Upsert payload included `batch` / `email` columns absent on live `leads` table → `db.py` filters to allowed columns.
   - Live `leads` lacked `UNIQUE(website_url)` for PostgREST `on_conflict` → migration `20260617_leads_website_url_unique.sql` applied.

**War Machine commits:** `ce5d8ee` (scraper), `9095223` (db upsert filter)

---

## YC smoke fallback

Local dry-run: `python scraper.py --source yc --max 3 --dry-run` → **1 lead** (Golf). YC path remains available for smoke tests via `source:"yc"`.

---

## Verdict for launch

War Machine **API + auth + async job + lead ingestion** are production-ready.

**Verdict:** **PASS** (data + pipeline)
