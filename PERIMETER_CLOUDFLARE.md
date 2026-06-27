# Perimeter — Cloudflare + Middleware Alignment

**Domain:** `forgeguard-ai.com` (proxied through Cloudflare → Vercel origin)

## DNS / SSL

| Setting | Value |
|---------|-------|
| Proxy status | **Proxied** (orange cloud) |
| SSL/TLS mode | **Full (strict)** |
| Always Use HTTPS | On |
| Minimum TLS | 1.2 |

## WAF / Bot defense (Cloudflare dashboard)

Align with `src/middleware.ts` + `src/lib/perimeter/*`:

| Rule | Path / signal | Action |
|------|---------------|--------|
| Rate limit | `/api/*` | 60 req/min per IP (tune with Vercel `RATE_LIMIT_*`) |
| Rate limit | `/auth/*` | 20 req/min per IP |
| Block | Known scraper UAs (Ahrefs, Semrush, etc.) | Block — mirrors `scraper-defense.ts` |
| Bot Fight Mode | Global | On if plan allows |
| Super Bot Fight | `/api/v1/scans`, `/auth/signup` | Challenge suspicious bots |

## App-side perimeter (no Workers in repo)

- `fortress-perimeter.ts` — honeypots, tar pit, threat scoring
- `perimeter_ip_blocklist` — hashed IP blocks (Supabase)
- `/admin/threat-console` — operator review
- **Legal only** — see `CITADEL_LAUNCH_VAULT/LEGAL_DEFENSE_POLICY.md` (no counter-attack malware)

## Optional

- **Turnstile** on `/auth/signup` if abuse spikes (not required for P0 demo)
- **Upstash Redis** (`UPSTASH_REDIS_*`) for distributed rate limits at edge + middleware

## Phase 1 trust layer (2026-06-27) — no Cloudflare change

Scope enforcement + immutable audit chain + compliance export ship entirely
in the Next.js app + Supabase + Railway engine. **No Cloudflare config,
Workers, or WAF rule changes** are required:

- `/api/scans/[id]/audit-export` is a standard Node runtime route — it rides
  the existing `60 req/min per IP` `/api/*` rate limit and Vercel origin.
- Audit events are append-only in Postgres (RLS + revoked UPDATE/DELETE);
  tamper-evidence is enforced at the DB + hash-chain layer, not the edge.
- If `pack_signature` verification is later needed at the edge, expose
  `SCAN_CREDENTIAL_SECRET` only to a dedicated Worker — do not place it in
  a Cloudflare page rule or public binding.

## Verification

```bash
curl -I https://forgeguard-ai.com
# Expect: cf-ray header, server cloudflare
```

Operator: confirm orange-cloud proxy in Cloudflare DNS for apex + `www`.
