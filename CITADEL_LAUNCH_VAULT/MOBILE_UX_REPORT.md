# MOBILE_UX_REPORT — ForgeGuard AI

**Date:** 2026-06-15  
**Viewport tested:** 390×844 (iPhone 14), 320px min-width  
**Deploy:** post Phase A–C identity + mobile pass

---

## Summary

| Area | Before | After |
|------|--------|-------|
| Identity flows | Face liveness + WebcamIdentity + Auditor webcam tab (3 face paths) | **FaceLiveness only** + **Gov ID file upload** |
| ID upload feedback | Silent until audit; MIME failures on mobile gallery | Filename/size preview, inline errors, extension + magic-byte MIME |
| Settings mobile | Sidebar clearance below fold | Clearance ladder **first on mobile** |
| Touch targets | 10px buttons on verification | **44px min** + `touch-manipulation` |
| Dashboard shell | Fixed pt-14 only | **safe-area-inset** top padding |
| Compliance chat | Overlapped home indicator | **safe-area-inset-bottom** on bubble + panel |
| Marketing hero | text-4xl min (tight on 320px) | **text-3xl** base, overflow-x-hidden |

---

## Pages fixed

- `/dashboard/settings` — mobile clearance order, removed duplicate Identity Proofing section
- `/dashboard/settings` — FaceLiveness full-width video, 240px min height
- `/dashboard/settings` — IdentityAuditor document-only, large drop zone
- `/dashboard/*` — shell safe-area + overflow-x-hidden
- `/` — hero H1 scaling, horizontal overflow guard
- `/auth/login` — inherits marketing nav mobile drawer fixes
- Compliance chat bubble — iOS home indicator clearance

---

## Identity upload test matrix

| Platform | File | Expected |
|----------|------|----------|
| Desktop Chrome | `.png`, `.PNG`, `.jpeg`, `.pdf` | Green "Received: …" → upload path → audit |
| Android Chrome | Gallery PNG/JPEG | Same (no `capture` forced) |
| iOS Safari | Photo library pick | MIME resolved via extension/sniff if `type` empty |

**Server:** `resolveDocumentMime()` — type → extension → magic bytes (`%PDF`, PNG, JPEG, WEBP).

---

## Screenshot paths (operator)

Save under `CITADEL_LAUNCH_VAULT/screenshots/mobile-ux/`:

- `settings-mobile-clearance-top.png`
- `face-liveness-mobile-video.png`
- `gov-id-received-badge.png`
- `hero-320px-no-scroll.png`

---

## PSI mobile (production)

Run after deploy:

```bash
curl -sI -A "Chrome-Lighthouse" https://www.forgeguard-ai.com/
```

Target: **200** `text/html`, no horizontal scroll on `/` and `/auth/login`.

---

## Related migrations

- `20260620_identity_proofed_to_liveness.sql` — backfill legacy webcam rows to `face_liveness_verified`
