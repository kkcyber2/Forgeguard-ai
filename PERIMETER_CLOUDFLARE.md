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

## Verification

```bash
curl -I https://forgeguard-ai.com
# Expect: cf-ray header, server cloudflare
```

Operator: confirm orange-cloud proxy in Cloudflare DNS for apex + `www`.
