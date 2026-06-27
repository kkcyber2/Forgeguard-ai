# Legal Consent v2 — Cryptographic Audit Trail

ForgeGuard gates **High** and **Nuclear** intensity scans behind a signed legal
authorization. v2 binds the consent to the authenticated user **and** the scan
target host with a SHA-256 signature so the record is tamper-evident and
non-reusable.

> **Disclaimer:** This is a *consent audit trail*, not an eIDAS / QES qualified
> electronic signature. It establishes that a signed-in user acknowledged the
> scan policy for a specific target at a specific time. It is suitable for
> internal compliance logs and abuse defense, not for notarized legal signing.

## Canonical payload

The signed string is built identically on the client (Web Crypto) and re-built
on the server (Node `crypto`) for verification:

```
${userId}:${target_host}:${typedSignature}:${policy_version}:${signedAtIso}
```

| Field | Source | Notes |
|-------|--------|-------|
| `userId` | `auth.uid()` | Authenticated user id at sign time |
| `target_host` | `normalizeConsentTargetHost(scan.target_url)` | Lowercased hostname |
| `typedSignature` | Modal legal-name input | The typed full name (≥2 chars) |
| `policy_version` | `LEGAL_POLICY_VERSION` = `v1.0-2026` | Single source of truth in `src/lib/legal/consent.ts` |
| `signedAtIso` | `new Date().toISOString()` | Full ISO, same value client → server |

**Hash:** `SHA-256(payload)` as lowercase hex (64 chars).

- Client: `window.crypto.subtle.digest("SHA-256", …)` — never `crypto-js`.
- Server: `node:crypto.createHash("sha256")`, compared with `timingSafeEqual`.

## Files

| Layer | File | Role |
|-------|------|------|
| Shared constants | `src/lib/legal/consent.ts` | `LEGAL_POLICY_VERSION`, payload builder, host normalizer, intensity mapper |
| Client signer | `src/lib/legal/consent-client.ts` | `buildLegalConsentSignature()` — Web Crypto SHA-256 |
| Server verifier | `src/lib/legal/consent-server.ts` | `verifyConsentHash()` / `verifyConsentRecord()` — Node crypto, constant-time |
| Modal | `src/components/scans/LegalVerificationModal.tsx` | Signs on submit; button "Cryptographically Sign & Proceed" |
| Server action | `src/app/dashboard/scans/legal-actions.ts` | Stores hash fields in `legal_authorizations` |
| Scan gate | `src/app/dashboard/scans/actions.ts` | `createScan` re-verifies hash, intensity match, single-use, 30-min replay window |
| Runner | `src/lib/runner/runner.ts` | Loads linked consent row, forwards fields to orchestrator |
| Engine | `AI-red-team/agathon/security/consent.py` | `verify_cryptographic_consent()` belt-and-suspenders; 403 on mismatch |
| Migration | `supabase/migrations/20260703_legal_consent_crypto.sql` | Adds `policy_version`, `target_host`, `signature_hash`, `signed_at`; REVOKE UPDATE/DELETE |

## Database — `legal_authorizations` (extended)

```sql
ALTER TABLE legal_authorizations
  ADD COLUMN policy_version  text        NOT NULL DEFAULT 'v1.0-2026',
  ADD COLUMN target_host     text,
  ADD COLUMN signature_hash  text        NOT NULL DEFAULT 'legacy-v1-pre-crypto',
  ADD COLUMN signed_at       timestamptz NOT NULL DEFAULT now();

REVOKE UPDATE, DELETE ON legal_authorizations FROM authenticated;
```

- INSERT only via service-role admin client (server action).
- Users SELECT own rows only (existing RLS policy).
- No UPDATE/DELETE for authenticated → effectively append-only.

## Verification at scan creation (`createScan`)

For non-sovereign **aggressive / greasy** scans, `createScan` rejects unless:

1. `legal_auth_id` present and owned by `user.id`
2. `consented = true`
3. `scan_id IS NULL` (single-use — a consent already bound to a scan cannot be reused)
4. `legal_authorizations.intensity` matches the scan intensity (`high`/`nuclear`)
5. `verifyConsentRecord()` passes:
   - `policy_version === 'v1.0-2026'`
   - `signed_at` within **30 minutes** of now (replay window)
   - `target_host` matches `normalizeHost(scan.target_url)`
   - rebuilt SHA-256 equals stored `signature_hash` (constant-time)

Only after all checks pass → insert scan → `UPDATE legal_authorizations.scan_id`.

## Engine belt (`agathon/security/consent.py`)

`runner.ts` forwards `consent_signature_hash`, `policy_version_accepted`,
`signer_name`, `consent_target_host` when a scan has a linked consent row.
`scan_start` re-runs `verify_cryptographic_consent()`:

- Mismatch → `log.critical(...)`; if consent is required for the intensity →
  HTTP **403**.
- Missing hash on a high-intensity, non-ownership-verified scan → **403**.
- Sovereign / ownership-verified scans skip the gate.

## Sovereign operator

`isSovereignOperator(user.email)` bypasses the legal gate entirely (existing
pattern) — no modal, no hash, no DB row.

## Audit retention

`legal_authorizations` rows are retained indefinitely (append-only). Each row
records `ip_address`, `user_agent`, `full_name`, `intensity`, `target_host`,
`policy_version`, `signature_hash`, `signed_at`, and the bound `scan_id`.

## Non-goals

- Not a QES / eIDAS qualified signature.
- Not identity-proofed against a government ID (the name is user-typed).
- Does not replace proof-of-ownership (DNS TXT token) — both gates run for
  above-Standard scans.
