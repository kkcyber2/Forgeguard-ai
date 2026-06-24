# Live Command Map v2

Real-time tactical map for admin command center. Pulses are driven by **platform telemetry only** — no decorative or hardcoded coordinates.

## Data sources

| Source | Table | Pulse trigger | Geo resolution |
|--------|-------|---------------|----------------|
| Scan kinetic events | `scan_logs` | `INSERT` where `type IN ('breach', 'strike')` | `resolveScanGeo(target_url)` from parent `scans` row (or `payload.target_url`) |
| Fortress blocks | `perimeter_events` | `INSERT` on rate-limit / webhook / honeypot blocks | `geo_lat` / `geo_lng` stored at insert (derived from hashed IP bucket) |
| External context | CISA KEV JSON (cached 1h) | **Not mapped** — text strip only | N/A |

## Geo rules

- **Scans:** `src/lib/admin/resolve-scan-node.ts` maps `target_url` hostname TLD/region heuristics → WGS84 PoP centroid. No pulse if `target_url` cannot be resolved.
- **Perimeter:** IP is hashed (`ip_hash`); raw IP is not stored in `perimeter_events`. Geo is deterministic from hash → PoP node.
- **Removed:** Hardcoded `openai.com` / `anthropic.com` realtime handlers, fallback pulses on arbitrary POP nodes when `activeScans > 0`.

## Realtime

Supabase `postgres_changes` channels:

- `scan_logs` INSERT — client filters `breach` / `strike` in handler
- `perimeter_events` INSERT — admin/authenticated read (RLS)

Both `scan_logs` and `perimeter_events` are in the `supabase_realtime` publication.

## UI

- **`LiveCommandMap`** — map + side **Live feed** (last 20 platform events)
- **External strip** — labeled `External · not ForgeGuard telemetry` (CISA KEV CVE list)
- **Mobile** — stacked layout (`map` above, feed below) below `md` breakpoint

## Fortress instrumentation

`logPerimeterEvent()` in `src/lib/perimeter/log-perimeter-event.ts` is called from:

- `middleware.ts` — `logAttackAttempt()`
- `fortress-perimeter.service.ts` — webhook token violations

Legacy `attack_logs` inserts remain for audit; map uses `perimeter_events`.

## Files

| Path | Role |
|------|------|
| `src/components/dashboard/live-command-map.tsx` | Map + feed composite |
| `src/components/dashboard/live-map-feed-panel.tsx` | Live feed + external strip |
| `src/lib/live-map/platform-events.ts` | Server bootstrap (20 events) |
| `src/lib/live-map/external-intel.ts` | Cached CISA KEV fetch |
| `src/lib/live-map/geo.ts` | IP hash, payload target extraction |
| `supabase/migrations/20260627_perimeter_events.sql` | Schema + RLS + realtime |

## Apply migration

Run `20260627_perimeter_events.sql` on Supabase project `nlginrukltrwpkyujzzx` before perimeter pulses appear in production.
