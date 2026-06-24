# Feature Audit — Live Map, Threats, Intel Hub, Genesis, Ghost, Replay

_Audit date: 2026-06-13 · Build verified after fixes_

Status key: **PASS** = real data + functional · **PARTIAL** = works with caveats/demo gaps · **FAIL** = broken or placeholder-only

---

## Summary

| Route / Feature | Status | Notes |
|-----------------|--------|-------|
| `/dashboard/recon` (surface map) | **PARTIAL** | Demo tree until first recon job; real API after |
| `/admin/threats` + `/admin` (Live Command Map) | **PASS** | Real `scan_logs` + `perimeter_events` + realtime |
| `/admin/threats` (Global Threat Board) | **PASS** | Real rollup from `scan_logs` findings |
| `/dashboard/intel` — Chat | **PASS** | `intel_messages` + realtime; ghost masking wired |
| `/dashboard/intel` — Feed | **PASS** | `social_posts` + likes; ghost author masking |
| `/dashboard/intel` — Teams | **PASS** | `teams` / invites / team-scoped posts |
| `/dashboard/intel` — Vault | **PASS** | OSINT runners + audit log |
| `/dashboard/intel` — Threat ticker | **PASS** | CISA KEV strip (cached 1h) |
| `/dashboard/scans/[id]` — Genesis RECON | **PASS** | `discovery_report` from `scan_reports` |
| `/dashboard/scans/[id]` — Genesis FINANCE | **PASS** | ALE + sealed fallback telemetry |
| `/dashboard/scans/[id]` — Genesis AEGIS | **PASS** | `aegis_zip_b64` download |
| `/dashboard/scans/[id]` — Genesis SOCIAL | **PASS** | Fixed: `social_templates` now in select |
| `/dashboard/scans/[id]` — Genesis MEMORIES | **PASS** | `agent_memories` query |
| Ghost Protocol gating | **PARTIAL** | Toggle + Bazaar/Missions/Runner; not route-level |
| Attack Replay Theater | **PASS** | Built from `scan_logs` + `attack_path` |

---

## 1. Dashboard “live map”

There is **no** `/dashboard/...` route using `LiveCommandMap`. Operator-facing map UX is split:

| Route | Component | Data |
|-------|-----------|------|
| `/dashboard/recon` | `SurfaceTree` (SVG OSINT map) | **PARTIAL** — loads `DEMO_MAP` until user runs `/api/recon/start`; history from `/api/recon/list` is real |
| `/admin/threats` | `LiveCommandMapClient` | **PASS** — bootstrap + Supabase realtime |
| `/admin` | Command Center embed | **PASS** — same map component |

**Geo caveat (PARTIAL):** scan pulses use hostname → PoP centroid (`resolveScanGeo`), not true IP geolocation. Perimeter events use stored `geo_lat`/`geo_lng` or hash-bucket fallback.

**Files:** `src/app/dashboard/recon/page.tsx`, `src/components/dashboard/live-command-map.tsx`, `src/lib/live-map/platform-events.ts`

---

## 2. `/admin` Global Threats (`/admin/threats`)

**Status: PASS**

- **Live map:** `fetchLiveMapBootstrap()` — `scan_logs` (breach/strike), `perimeter_events`, active `scans`
- **Threat board:** 72h `scan_logs` findings rolled up in `ThreatsFeed`
- **Stats:** sparklines, severity meter, unique surfaces — all from DB
- **Related:** `/admin/threat-console` — Fortress perimeter events + IP blocklist (separate from scan findings)

**Files:** `src/app/admin/threats/page.tsx`, `src/components/dashboard/threats-feed.tsx`

---

## 3. Intel Hub (`/dashboard/intel`)

**Access:** rank ≥ 3 (`RANK_3_PREFIXES` in `ranks.ts`). No dedicated gate layout (unlike Forge).

| Tab | Status | Backend |
|-----|--------|---------|
| Chat | **PASS** | `intel_messages` + `intel_messages_with_profile`; realtime INSERT; ghost aliases via `resolvePublicDisplayName` |
| Feed | **PASS** | `social_posts`, `social_post_likes`, profiles + trust tags |
| Teams | **PASS** | `teams`, `team_members`, team-scoped posts |
| Vault | **PASS** | `intel-vault-panel` → `vault-actions.ts`, `osint-runners.ts` |
| Threat ticker | **PASS** | `getExternalIntelStrip()` → CISA KEV JSON (1h cache) |

**Files:** `src/app/dashboard/intel/page.tsx`, `src/components/intel/intel-hub.tsx`, `src/lib/social/feed-actions.ts`

---

## 4. Genesis tabs (`/dashboard/scans/[id]`)

Intensity-gated tabs in `genesis-tabs.tsx`:

| Tab | Gate | Status | Source |
|-----|------|--------|--------|
| RECON MAP | always | **PASS** | `scan_reports.discovery_report` |
| FINANCIAL RISK | always | **PASS** | `financial_liability_usd` / `ale_usd`; platform sparkline when sealed w/o ALE |
| AEGIS BUNDLE | aggressive/greasy | **PASS** | `aegis_zip_b64` client download |
| SOCIAL SWARM | greasy only | **PASS** (fixed) | `social_templates` — was omitted from `SCAN_REPORT_SELECT` |
| AGENT_MEMORIES | greasy only | **PASS** | `agent_memories` table |

**Fix applied:** added `social_templates` to `SCAN_REPORT_SELECT` and `scanStatus` prop to `GenesisTabs`.

**Files:** `src/app/dashboard/scans/[id]/page.tsx`, `src/lib/scans/queries.ts`, `genesis-tabs.tsx`

---

## 5. Ghost Protocol gating

**Status: PARTIAL** (by design — identity masking, not route firewall)

| Area | Behavior |
|------|----------|
| **Enable gate** | Rank tier ≥ 3 **and** `subscription_tier === enterprise` (`canEnableGhostMode`) |
| **Toggle** | `ghost-protocol-toggle.tsx` (hacker persona top bar + settings) |
| **Masked surfaces** | Bazaar listings, missions identity, Agathon runner `is_ghost_active`, signature public view |
| **Intel Hub** | Feed + chat now mask `is_ghost_active` authors (fixed this audit) |
| **Does not block** | Route access, scan creation, leaderboard visibility |

**Files:** `src/lib/access/ghost-mode.ts`, `src/components/dashboard/ghost-actions.ts`

---

## 6. Attack Replay Theater

**Status: PASS**

- Embedded on `/dashboard/scans/[id]` when `status ∈ {sealed, failed}` and steps exist
- `buildAttackReplaySteps(scan_logs, attack_path)` — chronological breach/strike/thought/report phases
- UI: play/pause auto-advance (2.2s), phase-colored step pills

**Files:** `src/components/scans/attack-replay-theater.tsx`, `src/lib/evolve/replay-steps.ts`

---

## Fixes applied in this audit

1. **`SCAN_REPORT_SELECT`** — include `social_templates` (Social Swarm tab was always empty)
2. **`GenesisTabs`** — pass `scanStatus={scan.status}` for financial fallback telemetry
3. **Intel Feed** — `maskAuthorIfGhost` on `is_ghost_active` profiles
4. **Intel Chat** — ghost-aware display names on load + realtime
5. **Threat ticker** — wire CISA KEV via `getExternalIntelStrip()` on intel page

---

## Known limitations (documented, not bugs)

- `/dashboard/recon` shows labeled demo surface until first recon completes
- Live Command Map is admin-only (`/admin/threats`), not on dashboard nav
- Ghost Protocol does not hide routes; it masks public identity on selected surfaces
- Attack Replay requires sealed/failed scan with log rows (empty → component hidden)
- CISA ticker empty if external fetch fails (shows “advisories unavailable”)

---

## Verification

```bash
npm run build   # PASS after audit fixes
```

Manual smoke checklist:
- [ ] `/admin/threats` — map pulses + findings table populate
- [ ] `/dashboard/intel` — all four tabs load; ticker shows CVE IDs when online
- [ ] `/dashboard/scans/[id]` — greasy sealed scan shows Social Swarm if engine wrote templates
- [ ] Ghost on + enterprise — feed/chat show `OPERATOR_*` alias
