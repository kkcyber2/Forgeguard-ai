/**
 * OWASP LLM Top 10 (2025) mapping for ForgeGuard attack families.
 *
 * Family keys mirror the `FAMILY_*` constants in
 * AI-red-team/agathon/attack_tier_logic.py so findings from the engine map
 * consistently into the compliance evidence pack.
 */

import { OWASP_LLM_IDS } from "@/lib/almanac/types";

export interface OwaspLlmMapping {
  code: string;
  label: string;
}

const OWASP_LLM_LABELS: Record<string, string> = {
  LLM01: "Prompt Injection",
  LLM02: "Sensitive Information Disclosure",
  LLM03: "Supply Chain",
  LLM04: "Data and Model Poisoning",
  LLM05: "Improper Output Handling",
  LLM06: "Excessive Agency",
  LLM07: "System Prompt Leakage",
  LLM08: "Vector and Embedding Weaknesses",
  LLM09: "Misinformation",
  LLM10: "Unbounded Consumption",
};

// Family key → OWASP code. Garak families collapse to the same buckets as
// their canonical ForgeGuard family.
const FAMILY_TO_OWASP: Record<string, string> = {
  // Prompt injection family
  prompt_injection: "LLM01",
  indirect_prompt_injection: "LLM01",
  invisible_injection: "LLM01",
  token_smuggling: "LLM01",
  context_manipulation: "LLM01",
  emotional_manipulation: "LLM01",
  chain_of_thought_hijack: "LLM01",
  logic_jailbreak: "LLM01",
  mutation_loop: "LLM01",
  // Disclosure / exfiltration
  data_exfiltration: "LLM02",
  // Supply chain — no dedicated family yet
  // Poisoning
  rag_poisoning: "LLM04",
  // Output handling / excessive agency
  model_misuse: "LLM06",
  autonomous_adversary: "LLM06",
  custom_tool: "LLM06",
  rce_simulation: "LLM06",
  // System prompt leakage
  system_prompt_extraction: "LLM07",
  // Misinformation / robustness / hallucination
  adversarial_robustness: "LLM09",
  // Unbounded consumption
  economic_denial: "LLM10",
  // Recon — surface fingerprint / integrity probing
  recon: "LLM07",
  // Garak dynamic families
  garak_prompt_injection: "LLM01",
  garak_jailbreak: "LLM01",
  garak_pii_leak: "LLM02",
  garak_hallucination: "LLM09",
};

const DEFAULT_MAPPING: OwaspLlmMapping = {
  code: "LLM01",
  label: OWASP_LLM_LABELS.LLM01,
};

/**
 * Map an attack family to its OWASP LLM Top 10 (2025) code + label.
 * Unknown families fall back to LLM01 (Prompt Injection), the catch-all the
 * engine's probe catalogue is anchored on.
 */
export function mapFindingToOwaspLlm(family: string): OwaspLlmMapping {
  const key = (family ?? "").trim().toLowerCase();
  const code = FAMILY_TO_OWASP[key];
  if (!code || !OWASP_LLM_IDS.includes(code as (typeof OWASP_LLM_IDS)[number])) {
    return { ...DEFAULT_MAPPING };
  }
  return { code, label: OWASP_LLM_LABELS[code] ?? code };
}
