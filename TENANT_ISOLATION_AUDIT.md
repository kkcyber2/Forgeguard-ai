# Tenant Isolation Audit — P0 Demo Recovery

**Date:** 2026-06-13 (final pass)  
**Project:** `nlginrukltrwpkyujzzx` (ForgeGuard)

## Root cause (live DB)

| Policy | Table | Risk |
|--------|-------|------|
| `Public SEO view` (`USING true`) | `scans` | Any authenticated user could read **all** scans |
| `Public view reports` (`USING true`) | `scan_reports` | Any user could read **all** financial liability / ALE data |

**Fix:** migration `tenant_rls_hardening` — dropped public policies, hardened SELECT (applied live).

## Query inventory

| file | query | scoped? | risk | fix |
|------|-------|---------|------|-----|
| `src/lib/dashboard/fetch-overview.ts` | `scan_logs` last 24h | YES | P0 | `.in("scan_id", scanIds)` |
| `src/lib/dashboard/fetch-overview.ts` | `missions` in_progress | YES | P1 | `.or(client_id/selected_hacker_id)` |
| `src/lib/analytics/dashboard-metrics.ts` | platform metrics | N/A | P0 | `fetchUserDashboardAnalytics(userId)` on user routes |
| `src/app/dashboard/analytics/page.tsx` | analytics | YES | P0 | User-scoped only |
| `src/app/dashboard/scans/[id]/page.tsx` | telemetry trend | YES | P0 | `fetchUserDashboardAnalytics(supabase, user.id)` |
| `src/app/dashboard/scans/[id]/page.tsx` | `fetchCustomToolsForScan` admin | YES | P2 | Guard: `scan.user_id === user.id \|\| admin` |
| `src/app/dashboard/aegis/aegis-defense-stats.tsx` | scans + attack_logs | YES | P0 | `.eq("user_id", user.id)` |
| `src/hooks/use-live-ale-risk.ts` | `scan_reports` realtime | YES | P0 | Filter by user's `scan_id` set |
| `src/components/dashboard/tactical-world-map.tsx` | `scan_logs` INSERT | YES | P1 | `userId` + allowedScanIds gate |
| `src/components/dashboard/tactical-map-client-wrapper.tsx` | passes `userId` | YES | P1 | Prop wired to `TacticalWorldMap` |
| `src/lib/social/feed-actions.ts` | author profiles | YES | P0 | `profiles_public` view (no email) |
| `src/app/dashboard/missions/page.tsx` | profiles | YES | P2 | Fetch only mission `client_id`s |
| `src/lib/scans/queries.ts` | ALE / recent scans | YES | — | Already user-scoped |
| `src/app/api/debug/launch-check/route.ts` | env matrix | GATED | P0 | Sovereign session or `INTERNAL_SCAN_TOKEN`; else 404 |

## RLS verification (post-migration)

| table | SELECT policy | status |
|-------|---------------|--------|
| `scans` | `user_id = auth.uid() OR is_admin()` | PASS |
| `scan_logs` | via owned `scan_id` | PASS |
| `scan_reports` | via owned `scan_id` OR admin | PASS |
| `profiles` | own row OR admin | PASS |
| `profiles_public` | view — safe columns only | PASS |
| `crypto_deposits` | `user_id = auth.uid()` | PASS |
| `social_posts` | `social_posts_read` | PASS |
| `intel_vault_queries` | `intel_vault_queries_select_own` | PASS |

**MUST NOT exist:** `Public SEO view` on scans, `Public view reports` on scan_reports — verified absent.

## Acceptance checklist

- [x] Code: fresh user routes use user-scoped queries + RLS hardened
- [x] `profiles_public` live — feed cannot SELECT email
- [x] `/api/debug/launch-check` returns 404 without auth/token
- [ ] Fresh email signup → `/dashboard`: 0 scans, 0 findings, $0 ALE (operator smoke D1)
- [ ] Cannot open another user's scan UUID → 404 (operator smoke D1)
- [x] Sovereign: `/admin` + `/admin/analytics` platform totals; normal user redirected

## Operator action

```bash
# Verify policies (SQL editor)
SELECT policyname FROM pg_policies
WHERE tablename IN ('scans','scan_reports') AND policyname ILIKE '%public%';
# Expected: 0 rows

# Launch check (sovereign cookie or token)
curl -s -H "x-internal-scan-token: $INTERNAL_SCAN_TOKEN" https://forgeguard-ai.com/api/debug/launch-check
```
