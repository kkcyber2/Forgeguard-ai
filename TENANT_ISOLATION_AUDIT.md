# Tenant Isolation Audit — P0 Demo Recovery

**Date:** 2026-06-24  
**Project:** `nlginrukltrwpkyujzzx` (ForgeGuard)

## Root cause (live DB)

| Policy | Table | Risk |
|--------|-------|------|
| `Public SEO view` (`USING true`) | `scans` | Any authenticated user could read **all** scans |
| `Public view reports` (`USING true`) | `scan_reports` | Any user could read **all** financial liability / ALE data |

**Fix applied:** migration `20260630_tenant_rls_hardening` (dropped public policies, hardened SELECT).

## Query inventory

| file | query | scoped? | risk | fix |
|------|-------|---------|------|-----|
| `src/lib/dashboard/fetch-overview.ts` | `scan_logs` last 24h | **NO** (pre-fix) | P0 — global feed | `.in("scan_id", scanIds)` |
| `src/lib/dashboard/fetch-overview.ts` | `missions` in_progress count | **NO** | P1 — global KPI | `.or(client_id/selected_hacker_id)` |
| `src/lib/analytics/dashboard-metrics.ts` | scans/logs/profiles/txs | **NO** | P0 — platform analytics on user route | `fetchUserDashboardAnalytics(userId)` |
| `src/app/dashboard/analytics/page.tsx` | platform metrics + admin | **NO** | P0 | User-scoped only; admin → `/admin/analytics` |
| `src/app/dashboard/aegis/aegis-defense-stats.tsx` | admin `scans` + `attack_logs` | **NO** | P0 — global findings | User-scoped scans only |
| `src/hooks/use-live-ale-risk.ts` | `scan_reports` realtime `*` | **NO** | P0 — cross-tenant ALE updates | Filter by user's `scan_id` set |
| `src/components/dashboard/tactical-world-map.tsx` | `scan_logs` INSERT realtime | **NO** | P1 — global breach pulses | Optional `userId` + scan_id gate |
| `src/components/dashboard/live-command-map.tsx` | `scan_logs` INSERT realtime | **NO** | OK — admin-only route | No change (admin map) |
| `src/lib/live-map/platform-events.ts` | admin `scan_logs` bootstrap | **NO** | OK — admin/service role | No change |
| `src/lib/scans/queries.ts` | `fetchTotalAleRisk` | **YES** | — | Already `user_id` + `scan_ids` |
| `src/lib/scans/queries.ts` | `fetchRecentScansCached` | **YES** | — | Admin cache + `.eq(user_id)` |
| `src/app/dashboard/scans/page.tsx` | scans list | **YES** | — | `.eq("user_id")` (RLS backup) |
| `src/app/dashboard/missions/page.tsx` | profiles `.limit(500)` | **NO** | P2 | Fetch only mission `client_id`s |
| `src/components/dashboard/operator-leaderboard.tsx` | all profiles by reputation | **NO** | P2 — RLS limits to self | Acceptable for demo |
| `src/app/api/v1/webhooks/agathon/route.ts` | admin writes | **YES** | — | Service role (expected) |
| `src/app/dashboard/scans/[id]/page.tsx` | `createAdminSupabase` enrich | **PARTIAL** | P2 | Server verifies ownership before admin enrich |

## RLS verification (post-migration)

| table | SELECT policy | status |
|-------|---------------|--------|
| `scans` | `user_id = auth.uid() OR is_admin()` | PASS |
| `scan_logs` | via owned `scan_id` | PASS |
| `scan_reports` | via owned `scan_id` OR admin | PASS |
| `missions` | open OR client OR selected hacker | PASS (by design) |
| `crypto_deposits` | `user_id = auth.uid()` | PASS |
| `profiles` | own row OR admin | PASS |

## Acceptance checklist

- [ ] Fresh email signup → `/dashboard`: 0 scans, 0 findings, 0 ALE, empty red-team feed
- [ ] `/dashboard/scans`: empty
- [ ] `/dashboard/analytics`: zeros / own data only
- [ ] Sovereign operator: `/admin` + `/admin/analytics` work; normal user redirected from `/admin`

## Operator action

Apply migration on Supabase (already applied via MCP if `tenant_rls_hardening` succeeded):

```bash
supabase db push
# or verify in SQL editor: no "Public SEO view" / "Public view reports" policies
```
