# Operator Debug Playbook

## Vercel logs

Filter production logs (Vercel dashboard → Logs):

```
level:error
```

High-signal routes:

| route | what to watch |
|-------|----------------|
| `/api/webhooks/nowpayments` | IPN signature failures, grant errors |
| `/api/webhooks/agathon` | scan ingress, seal, finding_count |
| `/api/v1/scans` | scan start failures |
| `/dashboard/billing` actions | `[crypto/*]` deposit insert errors |

CLI (if linked):

```bash
vercel logs --follow
```

## Supabase — tenant isolation SQL

Run in SQL editor (`nlginrukltrwpkyujzzx`):

```sql
-- Should return 0 rows for a user with no scans
SELECT s.id, s.target_url
FROM scans s
WHERE s.user_id = 'USER_UUID_HERE';

-- Cross-tenant leak check (run as idea — use two test JWTs in app)
SELECT count(*) FROM scan_reports sr
JOIN scans s ON s.id = sr.scan_id
WHERE s.user_id = 'USER_A';

-- Verify dangerous policies are gone
SELECT policyname, qual FROM pg_policies
WHERE tablename IN ('scans','scan_reports') AND cmd = 'SELECT';
```

Expected: no `Public SEO view` or `Public view reports`.

## Launch check endpoint

```bash
curl -s https://YOUR_APP/api/debug/launch-check | jq
```

| field | healthy |
|-------|---------|
| `ok` | `true` |
| `checks.crypto.configured` | `true` (for billing demo) |
| `checks.engineProbe.ok` | `true` |
| `checks.supabase.serviceRoleSet` | `true` |
| `checks.envMatrixComplete` | `true` |

## NOWPayments

1. Dashboard → Payments → create **$10** test (Starter Pack)
2. Confirm IPN URL: `https://YOUR_APP/api/webhooks/nowpayments`
3. `NOWPAYMENTS_IPN_SECRET` must match dashboard IPN secret
4. On `finished`: `crypto_deposits.status = confirmed`, wallet/plan granted

## Railway (AI-red-team engine)

After pushing `forgeguard-ai` main, Railway auto-redeploys if linked to `AI-red-team` repo.

```bash
# Health
curl -s -H "Authorization: Bearer $INTERNAL_SCAN_TOKEN" $PYTHON_ENGINE_URL/health
```

MCP: use Railway `list_deployments` / `get_logs` for service `AI-red-team`.

## Demo smoke order

1. Fresh signup → empty dashboard
2. Billing → $10 credit pack QR → `tron:` URI
3. Sovereign operator → `/admin/analytics` shows platform data
4. Normal user → `/admin` blocked
