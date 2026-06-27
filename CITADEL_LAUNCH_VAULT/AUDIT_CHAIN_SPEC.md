# Audit Chain Spec — ForgeGuard Phase 1

A tamper-evident, hash-chained audit trail per scan, plus a signed
compliance evidence pack for enterprise buyers.

## Table — `scan_audit_events`

```sql
id             uuid        PK default gen_random_uuid()
scan_id        uuid        NOT NULL  references scans(id) ON DELETE CASCADE
user_id        uuid        NOT NULL
event          text        NOT NULL   -- scope_verified | scan_started | first_finding | scan_sealed
policy_version text
event_hash     text        NOT NULL   -- sha256(prev_hash || event || scan_id || created_at)
prev_hash      text                   -- previous row's event_hash (null for genesis)
created_at     timestamptz NOT NULL
```

- **RLS on**, `SELECT` only where `auth.uid() = user_id`.
- **No INSERT/UPDATE/DELETE policy for `authenticated`** — inserts only via
  the service role (server). `UPDATE`/`DELETE` revoked from `authenticated`.
- Index on `(scan_id, created_at)`.

## Hash format

```
event_hash = sha256( prev_hash || "|" || event || "|" || scan_id || "|" || created_at )
```

`prev_hash` is the previous row's `event_hash` (null for the first row).
`created_at` is generated **client-side** (not the DB default) so the hash
can be computed before insert and recomputed exactly on verify.

Pure primitive: `src/lib/compliance/audit-hash.ts::computeEventHash`
(no `server-only`, no Supabase → unit-testable).

## Files

| file | role |
|------|------|
| `src/lib/compliance/audit-hash.ts` | pure `computeEventHash` |
| `src/lib/compliance/audit-chain.ts` | `appendAuditEvent`, `appendAuditEventOnce`, `verifyAuditChain` |
| `src/lib/compliance/audit-chain.test.ts` | `node:test` for determinism + chain math |
| `supabase/migrations/20260704_scan_audit_events.sql` | table + RLS + revokes |
| `src/app/dashboard/scans/actions.ts` | appends `scope_verified` at scan create |
| `src/app/api/v1/webhooks/agathon/route.ts` | appends `scan_started` / `first_finding` / `scan_sealed` |

## Lifecycle events

| event | when | writer |
|-------|------|--------|
| `scope_verified` | scan row created | `createScan` (server action) |
| `scan_started` | first `status_update` → probing | agathon webhook |
| `first_finding` | first `scan.vector.breach` | agathon webhook |
| `scan_sealed` | `scan.completed` | agathon webhook |

`scan_started` and `first_finding` use `appendAuditEventOnce` so repeated
webhook deliveries don't duplicate the milestone. `scope_verified` and
`scan_sealed` fire once per scan by construction.

## `verifyAuditChain(admin, scanId) -> { valid, brokenAt, length }`

Fetches all rows for the scan ordered by `created_at` ascending, recomputes
each `event_hash` from the previous one, and compares to the stored value.
Returns `valid: false` at the first mismatch (`brokenAt` = 1-based index).

Because UPDATE/DELETE are revoked, any in-place edit of a row breaks the
link from its successor — the chain is tamper-evident, not just
append-only.

## Compliance evidence pack — `GET /api/scans/[id]/audit-export`

`runtime=nodejs`, `force-dynamic`.

**Authorization** (any one): scan owner (`scan.user_id === session.user.id`),
sovereign operator, or admin (access rank ≥ 5). Non-owners get **404**
(no existence leak).

**Body** (canonical, fixed key order):

```json
{
  "scan": { id, user_id, target_model, target_url, intensity, surface_kind,
            status, finding_count, high_severity_count, ale_usd,
            created_at, completed_at },
  "scope": { scope_host, scope_verified_at, target_host },
  "legal_authorization": { id, intensity, consented, signer_name,
                           policy_version, target_host, signature_hash, signed_at } | null,
  "audit_chain": { valid, length, events: [{ event, policy_version, event_hash, prev_hash, created_at }] },
  "chain_valid": bool,
  "findings": [{ attack, family, severity, success, owasp, owasp_label }],
  "owasp_mapping": [{ code, label }],
  "report": { risk_label, cvss_overall, attacks_run } | null,
  "generated_at": iso,
  "pack_signature": hex | null
}
```

**`pack_signature`** = `HMAC-SHA256(process.env.SCAN_CREDENTIAL_SECRET, canonicalJson)`
where `canonicalJson = JSON.stringify(pack)` (the body without
`pack_signature`). If `SCAN_CREDENTIAL_SECRET` is unset, `pack_signature`
is `null`.

### Verification (consumer)

1. Parse the JSON.
2. Remove `pack_signature`.
3. `JSON.stringify` the remaining object (key order preserved through
   parse) and recompute the HMAC with the shared secret.
4. Constant-time compare to `pack_signature`.
5. Re-run `verifyAuditChain` against the `audit_chain.events` to confirm
   `chain_valid`.

## Admin view — `/admin/audit`

Read-only, admin gate (rank ≥ 5). Lists the 50 most recent scans, shows a
chain badge (`Valid · N` / `Broken` / `No chain`) computed via
`verifyAuditChain`, and links to each scan's `audit-export` JSON.

## Tests

`node --test --experimental-strip-types src/lib/compliance/audit-chain.test.ts`
→ 2 cases pass (determinism + 64-hex; forward recompute + tamper detection).
