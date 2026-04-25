# Agathon — Production Architecture & Roadmap (v2)

**Status:** Decisions locked, ready to build.
**Owner:** ForgeGuard core
**Supersedes:** any prior Agathon notes in this folder.

**Locked decisions (this turn):**
- Scope at v1: **LLM apps only** (full AI Red catalogue + Brain orchestration)
- Worker host: **Railway persistent workers** with WebSocket transport
- Self-evolving tools: **ephemeral Docker containers** per custom tool, seccomp + read-only FS + no-network-by-default
- Live Brain: **Anthropic Claude** (Sonnet for the loop, Opus for reports)
- Realtime to UI: **Supabase Realtime** (existing) + **SSE** for chat
- Payments: **Stripe** — hybrid tiered subscription + metered overage on compute-seconds and brain tokens
- Reports: **Gold-standard** with CVSS v3.1 scores, PoC payloads, AI-generated remediation code

---

## 1. Topology — why Vercel + Railway, not just Vercel

Vercel serverless functions cap at **300 s** wall clock (Pro) and don't allow inbound WebSocket servers. Aggressive testing routinely runs 5–30 minutes. We split the system in two:

```
                        ┌──────────────────────────────────┐
                        │           VERCEL                 │
                        │  (Next.js App Router, edge+node) │
                        │                                  │
                        │  • Marketing site                │
                        │  • Auth (Supabase SSR)           │
                        │  • Dashboard (RSC)               │
                        │  • /api/scan/start  (dispatcher) │
                        │  • /api/agathon/chat (SSE)       │
                        │  • /api/stripe/webhook           │
                        │  • Brain HTTP gateway            │
                        └────────┬─────────────────────────┘
                                 │ HTTPS / WSS
                ┌────────────────┴────────────────┐
                │          RAILWAY                │
                │   (always-on Node + Python)     │
                │                                 │
                │  ┌───────────────────────────┐  │
                │  │ agathon-orchestrator      │  │
                │  │   • WS server (workers)   │  │
                │  │   • WS server (UI live)   │  │
                │  │   • Anthropic streaming   │  │
                │  │   • State cache (Redis)   │  │
                │  └────────────┬──────────────┘  │
                │               │                 │
                │  ┌────────────┴──────────────┐  │
                │  │ agathon-worker (Python)   │  │
                │  │   • JSON-RPC over WS      │  │
                │  │   • AI Red attack runner  │  │
                │  │   • Custom tool sandbox   │  │
                │  └───────────────────────────┘  │
                │                                 │
                │  ┌───────────────────────────┐  │
                │  │ agathon-sandbox-host      │  │
                │  │   (Docker-in-Docker)      │  │
                │  │   • Ephemeral containers  │  │
                │  │     for Brain-authored    │  │
                │  │     custom tools          │  │
                │  └───────────────────────────┘  │
                └─────────────────────────────────┘
                                 │
                                 ▼
                          SUPABASE
                  Postgres · Auth · Realtime · Storage
```

**Why this split is the right call:**
- Vercel keeps the site on the edge: sub-50 ms TTFB, free SSL, preview deploys, Stripe webhook isolation.
- Railway runs the always-on services: WebSocket servers, long-lived Python workers, Docker sandbox. Pay-per-use (~$5–25/mo idle, scales linearly with scans).
- Single Postgres (Supabase) backs both — no data duplication, no cross-region replication headaches.
- Brain calls happen on Railway (so we can stream Anthropic responses without Vercel's 300 s cap).

---

## 2. Engine integration — how AI Red and ForgeGuard merge

The merge is already half-shipped from earlier work this session (`src/lib/runner/runner.ts`, `Ai red/forgeguard_bridge.py`). Agathon promotes that integration into a closed-loop autonomous system. Three layers:

### Layer 1 — Attack catalogue (from AI Red, unchanged)
`Ai red/attacks/` provides the probes. We don't rewrite them. The `AttackResult` dataclass becomes Agathon's lingua franca. New attacks land here as `attacks/<family>/<name>.py`, auto-discovered.

### Layer 2 — Worker (Python, evolved from `forgeguard_bridge.py`)
- Today: spawned per scan, runs a fixed registry, exits.
- Agathon: long-lived, reads JSON-RPC over WebSocket, exposes:
  - `list_attacks()` → catalogue with family/difficulty/preconditions
  - `run_attack(name, target, params)` → AttackResult JSON
  - `run_custom_tool(spec)` → executes Brain-authored Python in Docker sandbox
  - `health()` → liveness + memory stats

### Layer 3 — Brain orchestrator (TypeScript on Railway)
- Holds the `AgathonState` per scan (in-memory + Redis backup).
- Streams to Anthropic with tool definitions; each tool call dispatches to the worker.
- Translates findings into `scan_logs` events the dashboard already renders.
- Decides scan termination via the `seal_scan` tool.

The result: the existing dashboard, RLS, auth, scan_logs pipeline, and `/dashboard/scans/[id]` live-log all work **unchanged**. The orchestrator becomes a smarter producer behind the same interface.

---

## 3. Self-evolving tools — Docker sandbox subsystem

When the Brain encounters a finding the catalogue can't fully exploit, it can author a custom Python tool on the fly. This is the most security-sensitive subsystem in Agathon. Three layers of defense:

### Tool spec contract
The Brain emits a structured spec, never freeform code in chat:
```json
{
  "name": "exfil_via_markdown_image",
  "language": "python",
  "entrypoint": "main.py",
  "files": { "main.py": "import sys, json, requests\n..." },
  "requires": ["requests==2.33.1"],
  "max_runtime_s": 30,
  "needs_network": true,
  "rationale": "Test if model renders markdown image URLs that exfil tokens via query string."
}
```

### Sandbox runtime
Each spec is executed in a fresh Docker container with these restrictions:
- Image: `python:3.12-slim` baseline, dependencies installed at boot
- `--read-only` root filesystem
- `--network none` by default; opt-in to a single egress allowlist (the target URL only)
- `--cap-drop ALL`, `--security-opt no-new-privileges`, seccomp profile (deny `clone`, `mount`, `ptrace`, `bpf`, etc.)
- `--memory 256m --cpus 0.5 --pids-limit 64`
- `--rm` so the container is destroyed on exit
- Wall-clock timeout enforced from the host; SIGKILL after `max_runtime_s + 5`

### Operator gate at v1
Per the SaaS-readiness goal, we ship **two modes**:
- **Auto-execute** (default for paid tiers): tool runs immediately if safety classifier passes
- **Review-then-run** (default for free tier and any tool that fails the classifier): tool surfaces in the UI for one-click execution

The "safety classifier" is a small Claude call against the tool spec checking for: filesystem writes outside `/tmp`, suspicious imports (`socket` raw, `ctypes`, `os.fork`), or attempts to read env vars beyond the allowlist. Result is logged for audit.

### Storage
Successful tools land in the `custom_tools` table (see schema), versioned, attributable to the scan that birthed them, available for re-use across the workspace.

---

## 4. Vercel serverless limits — how we live with them

Hard limits on Vercel functions:
- 300 s max execution (Pro), 10 s (Hobby)
- 4.5 MB request body, 10 MB response stream
- No inbound TCP/WebSocket server
- Max 50 concurrent connections per function instance (Pro)

**Strategy:** every long-running operation moves to Railway. Vercel routes are *dispatchers and gateways*, never workers.

| Vercel does | Railway does |
|---|---|
| `/api/scan/start` validates auth + RLS, then calls `POST orchestrator/scan` (returns in <100 ms) | Owns the scan lifecycle, holds open Anthropic streams, runs workers |
| `/api/agathon/chat` opens an SSE response, proxies tokens from Railway's HTTP-streamed Brain endpoint | Runs the chat brain, holds tool-use loops |
| `/api/stripe/webhook` verifies signature, writes to Postgres, optionally pings Railway to update entitlement cache | Reads entitlement cache, gates scan creation by quota |
| Dashboard SSR pulls scan_logs from Supabase RLS-scoped client | Inserts scan_logs via Supabase service-role from Railway |

**Edge runtime where possible:** chat SSE endpoint runs on Vercel Edge (`runtime: "edge"`) for sub-50 ms cold start. Edge can't import `child_process` or `pg`, but it can `fetch` and stream — that's all the chat proxy needs.

---

## 5. Database schema (Supabase / Postgres)

Full SQL is in `supabase/migrations/0002_agathon_schema.sql`. Summary of tables added or extended on top of the existing `profiles` / `scans` / `scan_logs`:

### Identity & billing
- **profiles** *(extend)* — add `stripe_customer_id`, `current_plan`, `entitlements_jsonb`
- **subscriptions** — Stripe subscription mirror: `id`, `user_id`, `stripe_subscription_id`, `stripe_price_id`, `plan`, `status`, `current_period_end`, `cancel_at_period_end`
- **payment_methods** — `id`, `user_id`, `stripe_pm_id`, `brand`, `last4`, `is_default`
- **invoices** — `id`, `user_id`, `stripe_invoice_id`, `amount_paid_cents`, `currency`, `status`, `hosted_invoice_url`, `period_start`, `period_end`
- **usage_events** — metered billing source of truth: `id`, `user_id`, `scan_id`, `kind` (`compute_seconds | brain_input_tokens | brain_output_tokens | custom_tool_runs`), `quantity`, `created_at`. Aggregated nightly into Stripe metered prices.

### Engine
- **scans** *(extend)* — add `intensity` (`recon | standard | aggressive | greasy`), `surface_kind` (`llm` at v1; column reserved for `web | mobile | code` in v2), `compute_seconds_used`, `brain_tokens_used`, `tool_count`
- **scan_logs** *(extend `type` enum)* — add `brain_decision`, `tool_run`, `tool_authored`, `cost_event`
- **brain_transcripts** — full Claude turn history per scan: `id`, `scan_id`, `turn_index`, `role`, `content_jsonb`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `latency_ms`. Separate table because turns are huge and the dashboard never paginates them — keeps `scan_logs` lean.
- **custom_tools** — Brain-authored tools: `id`, `scan_id` (origin), `user_id`, `name`, `spec_jsonb`, `safety_status` (`approved | rejected | pending`), `executions_count`, `created_at`
- **tool_executions** — every sandbox run: `id`, `tool_id`, `scan_id`, `started_at`, `ended_at`, `exit_code`, `stdout_preview`, `stderr_preview`, `result_jsonb`

### Reporting
- **scan_reports** — gold-standard reports: `id`, `scan_id` (UNIQUE), `generated_at`, `executive_summary_md`, `cvss_overall`, `findings_jsonb` (array of structured findings with CVSS v3.1 vector + PoC + remediation code), `attack_path_jsonb`, `optimization_suggestions_md`, `pdf_storage_key` (Supabase Storage). RLS: `user_id` derived from `scans` join.

### RLS posture
Every table is RLS-on. Patterns:
- Identity tables (`profiles`, `subscriptions`, `payment_methods`, `invoices`): `user_id = auth.uid()`
- Engine tables (`scans`, `scan_logs`, `custom_tools`, `tool_executions`, `brain_transcripts`, `scan_reports`, `usage_events`): scoped via `scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid())` or direct `user_id` check
- `is_admin()` `SECURITY DEFINER` function (already in repo from prior work) for admin-dashboard reads

---

## 6. Stripe — tiers, metering, gating

### Tier table

| Tier | Price | Included | Overage | Custom tools |
|---|---|---|---|---|
| **Free** | $0 | 5 scans/mo · 6 attacks each · `recon` intensity only | none — hard cap | review-then-run |
| **Operator** | $29/mo | 50 scans/mo · full catalogue · `standard` intensity · 50k Brain tokens | $0.05/scan · $5/M Brain tokens | review-then-run |
| **Red Team** | $129/mo | unlimited scans · all intensities incl. `greasy` · 500k Brain tokens · custom tools auto-execute | $5/M Brain tokens · $0.02/compute-second beyond 4 h/mo | auto-execute |
| **Enterprise** | contact | SSO, RBAC, dedicated Brain capacity, on-prem worker option, SLA | negotiated | auto-execute, custom safety policy |

Intensity → attack-budget mapping:
- `recon`: 6 attacks, no destructive payloads, max 2 min wall
- `standard`: 12 attacks, default Brain budget, max 8 min
- `aggressive`: 25 attacks, Brain may author one custom tool, max 20 min
- `greasy`: unlimited attacks until Brain seals or hits 30 min wall, custom tools unrestricted, parallel probes allowed

### Webhook flow
1. Stripe sends `checkout.session.completed` / `customer.subscription.updated` / `invoice.paid` / `invoice.payment_failed` to `/api/stripe/webhook` on Vercel.
2. Vercel verifies the signature with `STRIPE_WEBHOOK_SECRET`.
3. Writes to `subscriptions` + `invoices` + updates `profiles.entitlements_jsonb`.
4. Pings Railway's `/internal/refresh-entitlements?user_id=...` so the orchestrator's in-memory cache invalidates.

### Gating
At scan creation (`/api/scan/start`):
1. Read `profiles.entitlements` (cached on Railway, refreshed on webhook).
2. Compare requested `intensity` against allowed set; reject 402 if outside plan.
3. Decrement `scans_remaining_this_period`; if zero and tier is hard-capped, reject with upsell.
4. After scan seals, emit a `usage_event` row per metered dimension; nightly cron pushes aggregates to Stripe via `meter_event_summary` API.

### Why metered + tiered (not pure metered)
Pure metered scares away small operators (uncertainty about monthly bill). Pure tiered leaves money on the table when a Red Team customer runs an unusual month. Hybrid: predictable floor, fair ceiling.

---

## 7. Gold-standard report

Every sealed scan generates a report at `/dashboard/scans/[id]/report`. The Brain writes it once, immediately after `seal_scan`, using **Claude Opus** (non-streaming, prompt-cached on the report-format spec).

### Sections
1. **Executive Vulnerability Summary** — 3 paragraphs, plain English, CISO-readable. Risk score 0–10, top three findings, business impact.
2. **Technical Deep Dive** — per finding:
   - CVSS v3.1 vector + numeric score + severity
   - Vulnerability class (OWASP LLM Top 10 mapping)
   - Reproduction steps with the exact prompt/payload
   - Model response excerpt (truncated, secret-redacted)
   - Why it's exploitable (chain-of-reasoning)
3. **AI-Generated Remediation** — per finding:
   - Fixed code snippet (TypeScript and Python variants where applicable)
   - System-prompt patch suggestion
   - Tool/middleware addition diff
   - Test case to lock the fix in
4. **Optimization Suggestions** — performance and logic:
   - Token waste detected in system prompt
   - Redundant tool calls in observed traces
   - Latency hot spots
   - Suggested response-shape changes
5. **Attack Path Reconstruction** — sequential timeline of Brain decisions, tool calls, custom tools authored, and findings. Renders as a flowchart in the UI.
6. **OWASP LLM Top 10 Mapping** — coverage matrix: which OWASP-LLM categories were probed, which were vulnerable, which are clean.
7. **Appendix** — full Brain transcript (collapsed), raw scan_logs export, JSON download.

### Output formats
- HTML page (default view, interactive)
- PDF (rendered via the existing pdf skill, stored in Supabase Storage `scan-reports/{scan_id}.pdf`)
- JSON export (machine-readable for SIEM ingest)

### Cost discipline
- Hard cap input at 80k tokens per report. If `scan_logs` exceeds, run a map-reduce summarisation pass first.
- Prompt-cache the format spec + few-shot examples. Per-report cost target: <$0.40 on Opus.

---

## 8. Real-time data flow — Brain ↔ Engine ↔ Chat

The hardest design question. Three principles:

### Principle 1 — Single source of truth in Redis
`AgathonState` per scan lives in Redis on Railway, with this shape:
```ts
type AgathonState = {
  scanId: string
  status: "queued" | "probing" | "triage" | "sealed" | "failed"
  intensity: "recon" | "standard" | "aggressive" | "greasy"
  target: { url: string; model: string }
  progress_pct: number
  current_attack: { name: string; started_at: string } | null
  attacks_completed: Array<{ name: string; outcome: "blocked" | "leaked" | "audit"; severity: string }>
  findings_by_severity: { info: number; low: number; medium: number; high: number; critical: number }
  brain_last_decision: { tool: string; rationale: string; at: string }
  brain_tokens_used: number
  custom_tools_authored: string[]  // ids
  eta_seconds: number | null
}
```
Every component reads from this. Updates are funneled through a single writer (the orchestrator) so there's no split-brain.

### Principle 2 — Three transport tiers, picked per audience
| Audience | Channel | Why |
|---|---|---|
| Worker → Orchestrator | WebSocket (Railway internal) | Bidirectional, low overhead, persists across attacks |
| Orchestrator → Dashboard | Supabase Realtime on `scan_logs` | Already wired, free, fan-out for free |
| Orchestrator → Chat UI | SSE via Vercel proxy | One-way, fits Anthropic's streaming, works through corporate firewalls |
| Chat UI → Orchestrator | HTTPS POST | Stateless, chat history sent each turn |

### Principle 3 — Chat brain reads digest, not raw stream
On every chat turn, the chat brain receives a ~30-line digest derived from `AgathonState`, not the full `scan_logs` feed. Concrete digest format (rendered into the user message):
```
SCAN STATUS — id=abc123 status=probing intensity=greasy progress=64%
TARGET — gpt-4o @ api.openai.com
CURRENT ATTACK — system_prompt_extraction.reverse_psychology (started 12s ago)
COMPLETED — 8 attacks: 1 critical, 2 high, 1 medium, 4 audited
LAST BRAIN DECISION — request_pivot: "RAG attack skipped, target has no document tool"
CUSTOM TOOLS THIS SCAN — exfil_via_markdown_image (auto-executed, 1 finding)
RECENT FINDINGS:
  • [HIGH] system_prompt_extraction — partial leak via translation prompt
  • [CRITICAL] tool_allowlist_escape — file_read accepted /etc/passwd
  • [MEDIUM] base64_override — partial decode-and-execute
ETA — ~5 min
```
This is **80× smaller** than the raw scan_logs slice for the same answer quality, and Claude can prompt-cache the system prompt + tool definitions so chat TTFB stays under 300 ms.

If the user asks something the digest doesn't cover ("show me the exact response from finding #3"), the chat brain issues a tool call (`get_finding_detail`) → Postgres → result fed back → resumes streaming. Total latency ~600 ms even with one tool call.

### End-to-end timing budget (target P95)
- User opens chat panel: 0 ms (panel hydrates with current digest from `/api/agathon/state` — single Redis read)
- User sends message → first token to screen: **< 600 ms**
- Engine emits a finding → dashboard log row updates: **< 200 ms** (existing pipeline)
- Brain decision → next attack dispatched: **< 80 ms** (in-memory state, WS to worker)

---

## 9. Roadmap — 4-week build plan

Each sprint is **one week** and ends with a green build deployed to staging.

### Week 1 — Foundations
**Goal:** Railway services online, WebSocket protocol live, schema applied.
- `supabase/migrations/0002_agathon_schema.sql` — apply via Supabase MCP
- `services/agathon-orchestrator/` (Railway deploy) — Node + ws, `/healthz`, `/internal/scan/start`, `/internal/refresh-entitlements`
- `services/agathon-worker/` (Railway deploy) — Python, JSON-RPC over WS, `list_attacks` + `run_attack` working
- `forgeguard-ai/src/lib/agathon/{client.ts, types.ts}` — typed HTTPS+WS client to Railway
- `/api/scan/start` updated to call orchestrator instead of `runScan` directly (behind `AGATHON=on` flag)
- Smoke: end-to-end scan from form → orchestrator → worker → scan_logs → dashboard

### Week 2 — Live Brain + chat
**Goal:** Claude orchestrates an entire scan; chat panel works.
- `services/agathon-orchestrator/src/brain.ts` — Anthropic SDK, tool definitions, decision loop with hard caps (25 tool calls / 10 min / $5 budget)
- `services/agathon-orchestrator/src/state.ts` — Redis state + writer
- `forgeguard-ai/src/app/api/agathon/chat/route.ts` — Edge runtime SSE proxy
- `forgeguard-ai/src/components/dashboard/agathon-chat.tsx` — slide-in panel, streaming markdown
- `forgeguard-ai/src/components/dashboard/brain-track.tsx` — secondary log lane on scan detail showing brain_decision events
- Smoke: Brain runs a full scan unattended, picks 8+ attacks, seals appropriately; chat answers "what are you doing right now?"

### Week 3 — Custom tools + reports
**Goal:** Self-evolving tools work in sandbox; gold-standard reports generate.
- `services/agathon-sandbox-host/` (Railway deploy) — Docker-in-Docker container, exposes `runTool(spec)` over WS
- Brain tool: `author_custom_tool(spec)` — safety classifier + persist to `custom_tools` + execute via sandbox
- `services/agathon-orchestrator/src/report.ts` — Opus call, structured output schema, persists to `scan_reports`
- `forgeguard-ai/src/app/dashboard/scans/[id]/report/page.tsx` — report renderer
- `forgeguard-ai/src/components/dashboard/report/*` — section components (CVSS card, attack path timeline, remediation code block)
- PDF export via existing pdf skill, stored at `scan-reports/{scan_id}.pdf`
- Smoke: scan generates a custom tool, executes it safely, finding flows to report; report renders + downloads as PDF

### Week 4 — Stripe + polish + ship
**Goal:** Payments live, gating works, ready for first paying user.
- Stripe products + prices created (Free, Operator $29, Red Team $129)
- `forgeguard-ai/src/app/dashboard/billing/page.tsx` — plan selector, payment method, invoice history
- `forgeguard-ai/src/app/api/stripe/{checkout,portal,webhook}/route.ts`
- `forgeguard-ai/src/lib/billing/entitlements.ts` — single source of truth for plan limits
- Gating in `/api/scan/start` — 402 with upsell on quota exhaust
- Nightly cron (`vercel.json` cron or Railway scheduled task) — aggregate `usage_events` → Stripe `meter_event_summary`
- Marketing pages updated with pricing
- Final pass: docs, runbook, error budget alerts, Sentry on both Vercel and Railway
- Smoke: end-to-end purchase → scan → quota decrement → invoice in dashboard

---

## 10. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Brain authors a tool that escapes Docker sandbox | Critical | Multi-layer: read-only FS, no-network default, seccomp, dropped caps, pids cap, mem cap, wall-clock SIGKILL, safety classifier pre-flight |
| Stripe webhook signature spoofing | High | Verify signature with raw body; reject anything that fails; rate-limit endpoint |
| Anthropic outage stalls scans | High | 3-strike fallback to fixed-registry mode (`forgeguard_bridge.py`), surface banner in UI, queue scans for retry |
| Token cost runaway from Brain loop | High | Per-scan token budget enforced in orchestrator, kill switch at 110% of budget, per-user monthly cap |
| Railway worker process crashes mid-scan | Medium | Orchestrator watches `child.on('exit')`, persists state to Redis, auto-respawns worker, replays from last finding |
| Long scans tie up worker, blocking other users | Medium | Per-user concurrency cap by tier (Free=1, Operator=3, Red Team=10); excess scans queued |
| Postgres scan_logs grows unboundedly | Medium | Partitioning by month, rollup older than 90 days into `scan_logs_archive`, cold-storage to S3 after 1 year |
| User uploads a target URL pointing at internal Railway IPs (SSRF) | High | Allowlist scheme to https only, deny RFC1918/loopback/link-local at request time, deny redirects to those |
| User abuses scan target as a DDoS vector | High | Per-target rate limit (max 1 active scan per `target_url` per workspace), abuse review on >5 distinct targets/day for free tier |
| GDPR/data residency questions on stored payloads | Medium | All payloads stored in Supabase EU region; redact-on-insert for known PII patterns; per-user data export + delete endpoints |

---

## 11. Immediate next step

The unlock is **Week 1, item 1**: apply the database schema. Once the tables exist, every other piece (orchestrator, billing, reports, custom tools) has a place to write to. The schema is in `supabase/migrations/0002_agathon_schema.sql` — apply it before any code change.
