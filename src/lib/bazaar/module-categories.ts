/** Metasploit-style module taxonomy for Bazaar browse filters. */
export const BAZAAR_MODULE_CATEGORIES = [
  { id: "exploit", label: "Exploit", desc: "Direct attack primitives" },
  { id: "auxiliary", label: "Auxiliary", desc: "Support and recon modules" },
  { id: "payload", label: "Payload", desc: "Delivery and exfil chains" },
  { id: "post", label: "Post", desc: "Post-compromise tooling" },
  { id: "encoder", label: "Encoder", desc: "Obfuscation and evasion" },
  { id: "prompt", label: "Prompt", desc: "LLM jailbreak and injection" },
] as const;

export type BazaarModuleCategory = (typeof BAZAAR_MODULE_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return BAZAAR_MODULE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
