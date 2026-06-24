import "server-only";

import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export interface ProbeSuggestion {
  family: string;
  label: string;
  reason: string;
  breachCount: number;
}

const FAMILY_LABELS: Record<string, string> = {
  prompt_injection: "Prompt Injection",
  data_exfiltration: "Data Exfiltration",
  logic_jailbreak: "Logic Jailbreak",
  chain_of_thought_hijack: "Chain-of-Thought Hijack",
  system_prompt_extraction: "System Prompt Extraction",
  rag_poisoning: "RAG Poisoning",
  token_smuggling: "Token Smuggling",
  garak_jailbreak: "Garak Jailbreak",
  custom_tool: "Custom Brain Probe",
};

const ROTATION_FAMILIES = [
  "logic_jailbreak",
  "chain_of_thought_hijack",
  "system_prompt_extraction",
  "rag_poisoning",
  "token_smuggling",
  "data_exfiltration",
  "garak_jailbreak",
  "custom_tool",
] as const;

function familyFromPayload(payload: Record<string, unknown>): string | null {
  const raw =
    payload.family ??
    payload.attack_family ??
    payload.owasp_llm ??
    payload.title ??
    payload.attack;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.toLowerCase();
  if (s.includes("jailbreak")) return "logic_jailbreak";
  if (s.includes("exfil")) return "data_exfiltration";
  if (s.includes("cot") || s.includes("chain")) return "chain_of_thought_hijack";
  if (s.includes("system prompt")) return "system_prompt_extraction";
  if (s.includes("rag")) return "rag_poisoning";
  if (s.includes("token")) return "token_smuggling";
  if (s.includes("inject")) return "prompt_injection";
  return s.replace(/\s+/g, "_").slice(0, 48);
}

/**
 * Suggest next probe family from past breach corpus (training_corpus_events).
 */
export async function suggestNextProbeFromCorpus(): Promise<ProbeSuggestion | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = await (supabase as any)
    .from("training_corpus_events")
    .select("event_type, payload_json")
    .eq("user_id", user.id)
    .in("event_type", ["finding", "breach_log", "attack_path"])
    .order("created_at", { ascending: false })
    .limit(200);

  const breachFamilies = new Map<string, number>();
  for (const row of events ?? []) {
    const payload = (row.payload_json ?? {}) as Record<string, unknown>;
    const sev = String(payload.severity ?? "").toLowerCase();
    if (row.event_type === "finding" && sev !== "critical" && sev !== "high") {
      continue;
    }
    const family = familyFromPayload(payload);
    if (!family) continue;
    breachFamilies.set(family, (breachFamilies.get(family) ?? 0) + 1);
  }

  const tried = new Set(breachFamilies.keys());
  const next =
    ROTATION_FAMILIES.find((f) => !tried.has(f)) ??
    ROTATION_FAMILIES[breachFamilies.size % ROTATION_FAMILIES.length];

  const topFamily = [...breachFamilies.entries()].sort((a, b) => b[1] - a[1])[0];
  const breachCount = topFamily?.[1] ?? 0;

  if (breachCount === 0 && !events?.length) {
    return {
      family: "prompt_injection",
      label: FAMILY_LABELS.prompt_injection ?? "Prompt Injection",
      reason: "No prior breach corpus — start with baseline injection probes.",
      breachCount: 0,
    };
  }

  return {
    family: next,
    label: FAMILY_LABELS[next] ?? next.replace(/_/g, " "),
    reason: topFamily
      ? `Past breaches skew toward ${topFamily[0].replace(/_/g, " ")} (${topFamily[1]} hits). Rotate to ${next.replace(/_/g, " ")}.`
      : `Expand coverage with ${next.replace(/_/g, " ")} based on your scan history.`,
    breachCount,
  };
}
