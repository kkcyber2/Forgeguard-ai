# Attack Catalog — Probe Families

Canonical probe families used by the Agathon scan engine (`AI-red-team/agathon/attack_tier_logic.py` + `forgeguard_bridge.py`). ForgeGuard UI maps these to OWASP LLM findings and Attack Replay Theater steps.

**Legal scope:** Authorized red-team probes against operator-owned targets only. No malware, miners, or counter-attack payloads to third parties.

---

## Intensity tiers (DB enum)

| UI label | DB `scans.intensity` | Max attacks | Custom tools | Notes |
|----------|------------------------|-------------|--------------|-------|
| — | `recon` | 4 | 0 | Surface fingerprint |
| Standard | `standard` | 25 | 0 | Easy + medium families |
| High | `aggressive` | 80 | 8 | Hard families + Brain tools |
| Nuclear | `greasy` | 300 | 30 | Full arsenal + RCE simulation (sandboxed) |

Pre-launch budgets shown in `/dashboard/scans/new` mirror these ceilings (`src/lib/scans/intensity-budget.ts`).

---

## Probe families

### Recon
| Family key | Description |
|------------|-------------|
| `recon` | Latency, refusal rate, surface fingerprint |

### Easy
| Family key | Description |
|------------|-------------|
| `garak_prompt_injection` | Garak catalogue — direct injection |
| `garak_hallucination` | Hallucination / confabulation probes |
| `prompt_injection` | Classic instruction override |
| `data_exfiltration` | Markdown/image/URL exfil patterns |
| `context_manipulation` | Context window stuffing / reorder |
| `adversarial_robustness` | Perturbation / typo resilience |

### Medium
| Family key | Description |
|------------|-------------|
| `garak_jailbreak` | Garak jailbreak suite |
| `garak_pii_leak` | PII leakage probes |
| `model_misuse` | Capability abuse (tools, code) |
| `token_smuggling` | Delimiter / encoding smuggling |
| `emotional_manipulation` | Social pressure / guilt hooks |
| `invisible_injection` | Zero-width / homoglyph injection |

### Hard
| Family key | Description |
|------------|-------------|
| `chain_of_thought_hijack` | CoT reasoning manipulation |
| `system_prompt_extraction` | System prompt / policy leak |
| `rag_poisoning` | RAG context injection |
| `logic_jailbreak` | Multi-step logic bombs |

### Greasy / enterprise
| Family key | Description |
|------------|-------------|
| `autonomous_adversary` | Multi-turn autonomous pivoting |
| `custom_tool` | Brain-authored Python probes (Docker sandbox) |
| `rce_simulation` | Tool-calling agent abuse proofs (simulated, gated) |

---

## Custom tools (Brain evolve)

When intensity allows (`aggressive` / `greasy`), Agathon Brain may call `run_custom_tool`:

1. Python source authored by LLM
2. Executed in **read-only Docker sandbox** (no host RCE)
3. Persisted to `custom_tools` (`origin_scan_id`, `spec` JSON)
4. Fallback sync from `scan_logs` type `tool_authored` on `scan.completed` webhook
5. Surfaced in **Attack Replay Theater** as `custom_tool.<name>` steps

---

## Defense loop (Aegis)

| Stage | Mechanism |
|-------|-----------|
| Scan completes | Findings → `aegis_rules` auto-export (`aegis-auto-export.ts`) |
| Verify | `POST /api/v1/aegis/verify` with `{ prompt, appId }` — substring match on `rule_content` |
| Deploy | Genesis **Aegis bundle** `.zip` on sealed scans + one-click download on scan detail |
| App scope | `app_id = fg-<userId-prefix>` (`defaultAegisAppId`) |

---

## Corpus → next probe

On launch, `/dashboard/scans/new` reads `training_corpus_events` (user-scoped, redacted) and suggests a probe family to rotate after past critical/high breaches (`corpus-suggest.ts`).

---

## Surface kinds

| `surface_kind` | Probe modules |
|----------------|---------------|
| `llm` | Jailbreak, Garak, injection (production path) |
| `web` | XSS, logic discovery (beta) |
| `code` | BOLA/IDOR (beta) |
| `mobile` | Intent drift / tool-call injection (beta) |

---

_Source of truth for family lists: `AI-red-team/agathon/attack_tier_logic.py`. UI labels: `findings-report.tsx` `FAMILY_LABEL`._
