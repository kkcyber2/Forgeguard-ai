# Sprint Arc — Operator Launch Proof (Sprint 9)

Deferred until operator is ready to test (OpenRouter recharge, live scans).

## Checklist

1. Recharge OpenRouter on Railway
2. Run greasy smoke scan — `SCAN_STUCK_DEBUG.md`
3. Complete $10 USDT IPN — `OPERATOR_SMOKE.md` Step 1
4. D1–D5 browser — `DEMO_PROOF_CHECKLIST.md`
5. `node scripts/launch-proof-audit.mjs` after new sealed scan
6. Apply migrations if not live:
   - `20260710_agency_compartment.sql`
   - `20260711_agency_ops.sql`
   - `20260712_dev_versioning.sql`
   - `20260713_custom_attack_tool_versions.sql`
   - `20260714_sprint_arc_finish.sql`

## Citadel smoke (sovereign operator)

1. Visit `/citadel` — auto-bootstrap as compartment commander
2. Create case → Run fusion ingest → Add analyst note
3. View leads at `/citadel/leads`
4. Export STIX from case detail
5. Non-member gets **404** on `/citadel`
6. MFA enrolled users: `/auth/mfa-challenge` step-up for Citadel/Admin

## Sprint arc code verification (2026-06-28)

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run test:unit` | PASS (14 tests) |
| `npm run build` | PASS |
| Migrations | **OPERATOR** — apply via Dashboard or `npm run launch:db` |
