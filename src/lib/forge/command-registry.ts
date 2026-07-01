import "server-only";

import { SEEDED_SCRIPTS } from "@/lib/forge/seeded-scripts";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type ForgeCommand = {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  risk_tier: string;
  source: string;
  author: string | null;
};

/** DB-driven command registry with seeded-script fallback. */
export async function listForgeCommands(): Promise<ForgeCommand[]> {
  const admin = createAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("forge_command_registry")
    .select("id, name, description, language, category, risk_tier, source, author")
    .eq("enabled", true)
    .order("name");

  if (data?.length) {
    return (data as ForgeCommand[]).map((row) => ({
      ...row,
      source:
        row.source.startsWith("# seeded")
          ? SEEDED_SCRIPTS[row.id]?.source ?? row.source
          : row.source,
    }));
  }

  return Object.entries(SEEDED_SCRIPTS).map(([id, meta]) => ({
    id,
    name: meta.name,
    description: meta.description,
    language: meta.language,
    category: id === "escalation" ? "exploit" : "auxiliary",
    risk_tier: id === "escalation" ? "critical" : "medium",
    source: meta.source,
    author: "ForgeGuard",
  }));
}
