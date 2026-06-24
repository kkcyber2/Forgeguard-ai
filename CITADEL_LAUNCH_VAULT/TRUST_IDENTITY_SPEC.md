# Trust & Identity Spec (Tags v2)

Company tags are **claims of corporate affiliation**. They are only shown publicly when backed by DNS domain proof. Self-typed tags never earn verified display.

## Trust tiers

| Tier | Slug | Requirement | Company tag visible? | Badge |
|------|------|-------------|-------------------|-------|
| Unverified | `unverified` | Default | No | — |
| Domain | `domain` | `domain_verified = true` via DNS TXT (`forgeguard-verify=…`) | Yes — tag derived from verified domain | `[BRAND SEC]` acid green |
| Work email | `work-email` | Domain tier + `work_email_verified = true` (auth email `@company_domain`) | Yes | Same tag + work-email tier accent |
| KYC | `kyc` | `identity_verified = true` (document audit pipeline) | Yes (if domain tier met for tag) | Identity checkmark + tag |
| Sovereign | `sovereign` | Operator bypass / `clearance_tier = SOVEREIGN` / `sovereign_pending` | Per operator policy | Sovereign accent |

**Display rule:** `resolveVerifiedCompanyTag()` returns a tag **only** when `domain_verified === true`. KYC and sovereign tiers add identity trust signals but do not substitute for domain proof on company tags.

## Domain verification flow

1. User enters corporate domain (e.g. `acme.com`).
2. System stores `company_domain`, `domain_token`, sets `domain_verified = false`.
3. User publishes TXT: `forgeguard-verify={token}`.
4. On DNS check success: `domain_verified = true`, `company_tag = "{LABEL} SEC"` where `LABEL` is the first DNS label uppercased.
5. Reserved brands (see below) must match the verified domain (e.g. `google.com` → `GOOGLE SEC`).

## Reserved tags

These brand tokens cannot be used via self-typed input without DNS proof on a matching domain:

`GOOGLE`, `META`, `APPLE`, `AMAZON`, `MICROSOFT`, `NETFLIX`, `STRIPE`, `OPENAI`, `ANTHROPIC`, `FACEBOOK`, `INSTAGRAM`, `TWITTER`, `X`, `TESLA`, `NVIDIA`, `ORACLE`, `IBM`, `SALESFORCE`

Validation lives in `src/lib/trust/identity.ts` (`validateReservedTagForDomain`, `validateSelfTypedCompanyTag`).

## Work-email verification (optional)

After domain verification:

1. User must be signed in with email `*@{company_domain}`.
2. `verifyWorkEmail()` sets `work_email_verified = true`.
3. Elevates trust tier to `work-email` for badge accent / feed metadata.

## Enforcement surfaces

| Surface | Behavior |
|---------|----------|
| Shell top-bar (`IdentityBadge`) | Verified tag only via `resolveVerifiedCompanyTag` |
| Missions list / detail | Tag from client profile; gated on `domain_verified` |
| Mission create form | No self-typed persistence; preview shows strikethrough for unverified input |
| Intel feed | Author verified tag + trust tier on posts |
| Leaderboard | Verified tag only |
| Scan cards | Operator verified tag on scan list (owner profile) |

## Mission create

Server action `createMission` in `src/lib/trust/mission-actions.ts`:

- Ignores client-supplied `company_tag`.
- Sets `company_tag` and `domain_verified` from the poster's profile at insert time.
- Rejects reserved-brand attempts in form preview (client) before submit.

## No new illegal checks

This spec adds **identity display policy** only. It does not introduce new scan targets, OSINT runners, or offensive automation beyond existing legal OSINT scope.

## Files

- `src/lib/trust/identity.ts` — tier resolution, tag gating, reserved brands
- `src/lib/trust/mission-actions.ts` — trusted mission insert
- `src/components/trust/trust-tag-badge.tsx` — shared UI badge
- `supabase/migrations/20260626_work_email_verified.sql` — `profiles.work_email_verified`
