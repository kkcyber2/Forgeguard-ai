# TRAINING_DATA_MAP — ForgeGuard AI

Where offensive/defensive test artifacts live for future model training (legal, redacted, opt-out capable).

---

## Primary tables

| Data | Table / storage | Contents | Export |
|------|-----------------|----------|--------|
| **Scans** | `public.scans` | target, status, intensity, progress, timestamps | Via corpus events |
| **Scan logs** | `public.scan_logs` | `type` (strike, breach, thought, …), payload, attack_name | `breach_log` events (future) |
| **Scan reports** | `public.scan_reports` | findings JSONB, attack_path, remediation, OWASP, ALE | `finding` + `scan_completed` events |
| **Custom tools** | `public.custom_tools` | Auto-evolved attack tools from Agathon | Phase 2 export hook |
| **Aegis rules** | `public.aegis_rules` | Defense rules from findings | Phase 2 export hook |
| **Legal authorizations** | `public.legal_authorizations` | Consent / RoE records | Metadata only — no payloads |
| **Training corpus** | `public.training_corpus_events` | Redacted structured events per scan | Admin JSONL export |

---

## Corpus pipeline (Phase 1)

```
scan.completed webhook
  → ingestScanCompletedCorpus()
  → training_corpus_events (redact-secrets.ts)
  → exportable=false if profiles.training_corpus_opt_out
```

**Storage:** `training-corpus-private` bucket — `exports/corpus-{timestamp}.jsonl` (admin signed URL only).

**Admin UI:** `/admin/training-corpus` — event counts + Generate JSONL export.

---

## E2E acceptance

| Step | Evidence |
|------|----------|
| Migration applied | `training_corpus_events` table + `profiles.training_corpus_opt_out` |
| Scan completes | Row in `training_corpus_events` OR populated `scan_reports.findings` |
| Admin export | JSONL file in `training-corpus-private/exports/` |

---

## Legal constraints

- No raw PII dumps, passwords, or doxxing in corpus payloads  
- `redact-secrets.ts` masks API keys / tokens in all text fields  
- Users may opt out via `profiles.training_corpus_opt_out` (Settings toggle — Phase 6 UI)
