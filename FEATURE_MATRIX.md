# Feature Matrix — Demo Script

**Legend:** PASS = expected after P0 fixes | FAIL = known gap | GATE = rank/access

| route | auth | rank gate | data scope | status |
|-------|------|-----------|------------|--------|
| `/auth/login` | public | — | — | PASS |
| `/auth/signup` | public | — | GitHub + Google only (Discord removed) | PASS |
| `/dashboard` | required | 1 | own scans/logs/ALE | PASS |
| `/dashboard/scans` | required | 1 | own scans | PASS |
| `/dashboard/scans/new` | required | 1 | own | PASS |
| `/dashboard/analytics` | required | 2 | **own** metrics | PASS |
| `/dashboard/billing` | required | 1 | own deposits + vault modal | PASS |
| `/dashboard/intel` | required | 3 | vault tab user-scoped | PASS |
| `/dashboard/aegis` | required | 1 (client) | own defense stats | PASS |
| `/dashboard/missions` | required | 1–3 | open missions / own (RLS) | PASS |
| `/dashboard/forge` | required | 3 | own sessions | GATE |
| `/dashboard/bazaar` | required | 3 | marketplace | PASS |
| `/resources/almanac` | public | — | CVE almanac read | PASS |
| `/admin` | required | 5 | platform (admin) | PASS |
| `/admin/analytics` | required | 5 | platform-wide | PASS |
| `/admin/threats` | required | 5 | global live map | PASS |
| Theme toggle | required | 1 | profile preference | PASS |

## Personas

### 1. Brand-new user (no scans)

| check | expected |
|-------|----------|
| Overview KPIs | 0 scans, 0 findings, $0 ALE |
| Red team feed | empty |
| Analytics | all zeros |
| Billing vault | QR generates (if NOWPayments configured) |

### 2. Normal user (1 sealed scan)

| check | expected |
|-------|----------|
| Overview | only their scan card + logs |
| ALE | only their `financial_liability_usd` |
| Cannot open other user's scan UUID | 404 / empty |

### 3. Sovereign operator (rank 5 / admin)

| check | expected |
|-------|----------|
| Sidebar Admin + Global Map | visible |
| `/admin/analytics` | platform totals |
| Normal user cannot access `/admin` | redirect `/dashboard` |

## P1 / out of scope

| item | note |
|------|------|
| Operator leaderboard | RLS hides other profiles — shows self only |
| Mission client tags for hackers | needs limited public profile policy |
| OpenRouter scan E2E | separate prompt |
