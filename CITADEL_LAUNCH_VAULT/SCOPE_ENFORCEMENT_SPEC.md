# Scope Enforcement Spec — ForgeGuard Phase 1

Stop a verified user from scanning a target they don't own. The ownership
token proves control of *some* host; scope enforcement guarantees the scan
target's host is **within** the verified host (apex or a subdomain of it).

## Files

| file | role |
|------|------|
| `src/lib/scans/scope.ts` | pure `normalizeHost` + `isWithinScope` (unit-tested) |
| `src/lib/scans/scope.test.ts` | `node:test` cases for the scope math |
| `src/app/dashboard/scans/ownership-actions.ts` | `verifyScanOwnership` returns `verifiedHost` |
| `src/app/dashboard/scans/actions.ts` | `createScan` scope gate + stores `scope_host` / `scope_verified_at` |
| `supabase/migrations/20260704_scan_scope_host.sql` | `scans.scope_host`, `scans.scope_verified_at` |
| `src/lib/runner/runner.ts` | forwards `scope_host` + `scope_verified` to the engine |
| `AI-red-team/agathon/orchestrator.py` | `StartScanRequest.scope_host` / `scope_verified` + WARNING log |

## `normalizeHost(url) -> string | null`

- lowercase
- strip a single trailing dot
- drop default ports (`:80` / `:443`)
- strip a leading `www.`
- return `null` on invalid URL or empty host

## `isWithinScope(targetHost, verifiedHost) -> boolean`

Both inputs are normalized internally. Containment is:

1. **exact match** (both normalized), or
2. **subdomain**: `targetHost` ends with `.` + apex.

The suffix check is label-anchored, so `notexample.com` is **not** within
`example.com`, and `victim.com` is **not** within `example.com`.

Examples:

| target | verified | within scope |
|--------|----------|--------------|
| `api.example.com` | `example.com` | ✅ |
| `example.com` | `example.com` | ✅ |
| `deep.a.b.example.com` | `example.com` | ✅ |
| `victim.com` | `example.com` | ❌ |
| `notexample.com` | `example.com` | ❌ |

## createScan gate

Applied at the **same tier gate as ownership** — `intensity > standard`
(`aggressive` / `greasy`). After `verifyScanOwnership` succeeds:

```
targetHost   = normalizeHost(scan.target_url)
verifiedHost = ownership.verifiedHost
if !sovereign and (!verifiedHost || !isWithinScope(targetHost, verifiedHost)):
    reject: "Target is outside your verified scope. Verify this domain first."
```

On success, `scope_host = verifiedHost` and `scope_verified_at = now()` are
written to the `scans` row.

### Sovereign bypass

`isSovereignOperator(email)` skips the gate. The scanned host is still
recorded on the row for audit (`scope_host = normalizeHost(target)`,
`scope_verified_at = now()`, self-attested).

### recon / standard

No ownership token required → no scope gate. `scope_host` / `scope_verified_at`
stay `null`. (Intentional: light tiers don't require proof of ownership.)

## Engine belt-and-suspenders

`StartScanRequest` accepts optional `scope_host` and `scope_verified`. In
`scan_start`, if `scope_verified is False` and the caller is not sovereign
(`ownership_verified`), the engine logs a `WARNING` and **still runs** —
ForgeGuard is the source of truth for scope; the engine only records the
anomaly for the audit trail.

## Tests

`node --test --experimental-strip-types src/lib/scans/scope.test.ts` →
3 cases pass (normalization, null handling, containment + suffix traps).
