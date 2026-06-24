# Citadel Intel Vault — Legal OSINT Scope

**Phase 4 · ForgeGuard AI · Supabase `nlginrukltrwpkyujzzx`**

The Intel Vault is a **legal, passive OSINT** tool inside `/dashboard/intel` (Vault tab). Operators may only run queries defined in this document. All activity is rate-limited, stored in `intel_vault_queries` / `intel_vault_results`, and written to `intel_vault_audit`.

---

## Allowed query types

| Type | What it does | Data source |
|------|--------------|-------------|
| **dns** | Resolve A, AAAA, MX, NS, TXT, CNAME | Public DNS (Node `dns/promises`) |
| **whois** | Registration metadata via RDAP | Public RDAP endpoints (e.g. `rdap.org`) |
| **certs** | TLS certificate subject, issuer, validity | Outbound TLS handshake to target :443 |
| **robots** | Fetch `/robots.txt` | Single HTTP GET to public URL |
| **security_txt** | Fetch `/.well-known/security.txt` | Single HTTP GET to public URL |
| **headers** | Security-relevant response headers | Single HTTP HEAD/GET to public URL |

### Allowed techniques

- Public WHOIS / RDAP lookups
- Public DNS resolution
- Reading publicly published TLS certificates
- Fetching publicly accessible `robots.txt` and `security.txt`
- Inspecting **public** HTTP response headers (no auth, no cookies injected)
- Linking vault results to a scan the operator owns (`scan_id` optional)

---

## Forbidden

| Category | Examples |
|----------|----------|
| **Credential attacks** | Credential stuffing, password spraying, brute force |
| **Private data** | Doxxing, scraping personal emails/phones, non-public PII |
| **Unauthorized access** | Bypassing auth, exploiting vulnerabilities, port scanning beyond passive TLS |
| **ToS violations** | Aggressive scraping, circumventing rate limits on third-party APIs |
| **Internal targets** | `localhost`, RFC1918, link-local, metadata IPs (SSRF blocked server-side) |
| **Social engineering** | Phishing prep, impersonation intel |

Operators must only query domains they are authorized to assess (their own assets, client scope, or bug-bounty programs).

---

## Rate limits (enforced in `runIntelVaultQuery`)

| Limit | Value |
|-------|-------|
| Per user per hour | 30 queries |
| Per user per minute | 6 queries |
| Max domain length | 253 chars |
| Fetch timeout | 8 seconds |

Violations return `{ error: "Rate limit exceeded…" }` and are audit-logged.

---

## Audit trail

Every query creates:

1. Row in `intel_vault_queries` (pending → completed/failed)
2. Row in `intel_vault_results` (JSON payload or error)
3. Row in `intel_vault_audit` (`action`: `query_started`, `query_completed`, `query_failed`, `rate_limited`)

Moderators (`profiles.access_level >= 4`) may read all audit rows via RLS; operators see their own.

---

## Scan linkage (“Recon context”)

When `scan_id` is provided, results appear on `/dashboard/scans/[id]` under **Recon context** if the scan belongs to the same user. This is read-only context — it does not trigger Agathon or consume OpenRouter credits.

---

## References

- [RFC 9116 — security.txt](https://www.rfc-editor.org/rfc/rfc9116.html)
- [RDAP](https://about.rdap.org/)
- ForgeGuard `TARGET_RATINGS.md` — product quality bar for Intel features
