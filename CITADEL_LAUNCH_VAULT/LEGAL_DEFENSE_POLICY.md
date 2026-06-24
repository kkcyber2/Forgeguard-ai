# Legal Defense Policy — Fortress Perimeter v2

ForgeGuard AI operates **defensive perimeter controls** only. This document defines what the platform does and explicitly does **not** do when responding to scrapers, credential stuffers, and automated attackers.

## What we do (legal, proportionate)

| Control | Behavior |
|--------|----------|
| **Telemetry** | Log perimeter events with **hashed IP** (`ip_hash`), path, severity, reason, and GeoIP from platform headers (`x-vercel-ip-country`, `cf-ipcountry`, coordinates when present). |
| **Honeypots** | Decoy paths (`/.env`, `/api/.env.bak`, `/wp-admin`, etc.) that never serve real secrets. Hits are logged and increase threat score. |
| **Threat scoring** | Rolling score per hashed IP (honeypot +50, scraper/PoW +20, rate limit +15, webhook abuse +100). |
| **Auto-block** | When score ≥ 80, IP hash is blocked at middleware for 24h (configurable via `FORTRESS_BLOCK_TTL_SEC`). Stored in `perimeter_ip_blocklist` + optional Upstash cache. |
| **Tar pit** | Optional 2–5s delay for flagged IPs (`FORTRESS_TARPIT` ≠ `0`, score ≥ 40). **No code execution** on the client. |
| **Rate limits & PoW** | Standard burst limits and proof-of-work challenges for abusive automation. |
| **Admin console** | `/admin/threat-console` — review events, active blocks, manual unblock. |

## What we do NOT do

- **No malware** — no binaries, droppers, or “counter-attack” downloads.
- **No cryptominers** — no WebAssembly/JS mining, no CPU exhaustion traps beyond optional PoW challenges the client must solve to continue.
- **No RCE** — no remote code execution payloads aimed at attackers.
- **No “destroy attacker PC”** — no fork bombs, disk wipers, or hostile content in responses.
- **No deceptive payloads** — responses are 403/429 JSON or bunker PoW pages, not weaponized files.

## Data handling

- Public map and admin views use **hashed IPs** in `perimeter_events` and `perimeter_ip_blocklist`.
- `blacklisted_entities` may retain raw IP for internal service-role audit (legacy table); new blocklist rows are hash-only.
- Blocks expire automatically; operators can unblock via Threat Console.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `FORTRESS_TARPIT` | enabled | Set `0` to disable tar pit delays |
| `FORTRESS_BLOCK_TTL_SEC` | `86400` | IP block duration |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | optional | Distributed block + score cache |

## Compliance stance

Controls are **preventive and observational**: block, slow, log, and challenge — not retaliate. Operators are responsible for ensuring deployment jurisdiction allows these standard WAF-style measures.

_Last updated: Fortress Perimeter v2 (2026-06-29)._
