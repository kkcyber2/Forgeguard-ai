# TARGET_RATINGS — ForgeGuard vs Fable 5 (product quality)

**Baseline audit:** 2026-06-17 · **Goal:** 10/10 aspirational on every surface  
**Scope:** Product UX, pipeline depth, community, training moat — not raw model IQ alone

---

## Current baseline (post Phase 0)

| Dimension | Current | Target (Phase 9) | Gap / notes |
|-----------|---------|------------------|-------------|
| **Core scan → report** | 8/10 | 9/10 | Agathon webhook, scan_reports, PDF gating work; needs Attack Replay Theater |
| **Billing / Sovereign Vault** | 7→8/10 | 9/10 | P0 fix: legacy `address_generated`/`amount_usd` sync; live IPN operator test pending |
| **War Machine → leads** | 9/10 | 9/10 | **50 PH leads** ingested; Marine Swarm 202 OK |
| **Identity / clearance** | 8/10 | 9/10 | Face liveness + gov ID; mobile operator test pending |
| **Training data pipeline** | 3→6/10 | 10/10 | Phase 1: `training_corpus_events` + admin export (in progress) |
| **Auto-evolve attack** | 5/10 | 9/10 | `custom_tools` schema exists; E2E wiring TBD (Phase 2) |
| **Auto-evolve defense** | 6/10 | 9/10 | `/api/aegis/export` exists; closed-loop re-scan TBD |
| **Community / social** | 4/10 | 9/10 | Intel chat only; feed/teams Phase 3 |
| **Citadel Intel Vault** | 2/10 | 8/10 | Legal OSINT vault Phase 4 |
| **Startup / Client HQ** | 6/10 | 9/10 | Parallel sovereignty exists; dedicated HQ Phase 5 |
| **Auth hardening** | 7/10 | 9/10 | Reset/2FA/leaked-password Phase 6 |
| **E2EE** | 3/10 | 7/10 | Scoped team channels Phase 7 |
| **Forge Terminal** | 5/10 | 9/10 | xterm command registry Phase 8 |
| **vs Fable (overall product)** | **6.5/10** | **9/10** | Depth toggle + leaderboard + CLI Phase 9 |
| **Metasploit-for-AI feel** | 6/10 | 9/10 | Bazaar modules naming + replay theater |
| **Platform launch readiness** | **GO** | GO | Was CONDITIONAL GO (~92%); billing scrape blockers cleared |

---

## Weighted launch score

| Area | Weight | Score | Weighted |
|------|--------|-------|----------|
| Scan + engine | 25% | 8.0 | 2.00 |
| Billing + identity | 20% | 7.5 | 1.50 |
| Outreach (War Machine) | 10% | 9.0 | 0.90 |
| Training moat | 15% | 6.0 | 0.90 |
| Community | 15% | 4.0 | 0.60 |
| Auth + compliance | 15% | 7.0 | 1.05 |
| **Total** | | | **~6.95 / 10 → ~92% conditional** |

After Phase 1–2 target: **~7.8**. After Phase 9 target: **~9.0**.

---

## North-star (10/10 definition)

1. **Scan:** Multi-turn Fable-depth mode, animated replay, one-click Aegis apply, re-scan proves block  
2. **Billing:** Sovereign Vault QR + pending row in &lt;2s; IPN confirms without ops intervention  
3. **Training:** Every sealed scan → redacted corpus event; monthly JSONL export; user opt-out honored  
4. **Community:** Feed + teams + rank badges; legal intel vault with moderation  
5. **Beat Fable on product:** Public leaderboard, CLI, demo scan, module-style Bazaar — without custom model yet
