"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { auditToolCode } from "@/lib/developer/audit-tool";

export interface ToolFormState {
  ok: boolean;
  error?: string;
  toolId?: string;
  auditSummary?: string;
  verdict?: string;
  riskScore?: number;
}

export const TOOL_FAMILIES = [
  "recon",
  "web",
  "code",
  "mobile",
  "prompt",
  "agent",
  "secrets",
  "infra",
] as const;

export const TOOL_INTENSITIES = ["recon", "standard", "aggressive", "greasy"] as const;

type Family = (typeof TOOL_FAMILIES)[number];
type Intensity = (typeof TOOL_INTENSITIES)[number];

function isFamily(v: string): v is Family {
  return (TOOL_FAMILIES as readonly string[]).includes(v);
}
function isIntensity(v: string): v is Intensity {
  return (TOOL_INTENSITIES as readonly string[]).includes(v);
}

async function authorAccessLevel(userId: string, email: string | undefined) {
  const sovereign = isSovereignOperator(email);
  if (sovereign) return { ok: true as const, accessLevel: 5 };
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", userId)
    .maybeSingle();
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;
  if (accessLevel < 3) {
    return { ok: false as const, error: "Rank 3+ required to author attack tools." };
  }
  return { ok: true as const, accessLevel };
}

export async function createCustomAttackTool(
  _prev: ToolFormState,
  formData: FormData,
): Promise<ToolFormState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const gate = await authorAccessLevel(user.id, user.email);
  if (!gate.ok) return { ok: false, error: gate.error };

  const name = String(formData.get("name") ?? "").trim();
  const familyRaw = String(formData.get("family") ?? "").trim();
  const intensityRaw = String(formData.get("intensity_min") ?? "").trim();
  const code = String(formData.get("code") ?? "");
  const networkAllowed = formData.get("network_allowed") === "on";

  if (name.length < 3 || name.length > 80)
    return { ok: false, error: "Name must be 3–80 characters." };
  if (!isFamily(familyRaw)) return { ok: false, error: "Invalid tool family." };
  if (!isIntensity(intensityRaw)) return { ok: false, error: "Invalid intensity tier." };
  if (code.length < 10 || code.length > 50_000)
    return { ok: false, error: "Tool source must be 10–50,000 characters." };

  const audit = auditToolCode(code, networkAllowed);
  if (audit.verdict === "rejected") {
    return {
      ok: false,
      error: `Static audit rejected this probe (${audit.summary}). Remove sandbox-escape primitives before submitting.`,
      auditSummary: audit.summary,
      verdict: audit.verdict,
      riskScore: audit.risk_score,
    };
  }

  const { data: tool, error } = await supabase
    .from("custom_attack_tools")
    .insert({
      author_id: user.id,
      name,
      family: familyRaw,
      intensity_min: intensityRaw,
      code,
      network_allowed: networkAllowed,
      status: "pending",
      audit_result: audit.summary,
    })
    .select("id")
    .single();

  if (error || !tool) {
    console.error("[developer] insert error:", error);
    return { ok: false, error: "Database error — could not submit tool." };
  }

  revalidatePath("/dashboard/developer");
  return {
    ok: true,
    toolId: tool.id,
    auditSummary: audit.summary,
    verdict: audit.verdict,
    riskScore: audit.risk_score,
  };
}

export async function deleteCustomAttackTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const { error } = await supabase
    .from("custom_attack_tools")
    .delete()
    .eq("id", toolId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[developer] delete error:", error);
    return { ok: false, error: "Could not delete tool." };
  }
  revalidatePath("/dashboard/developer");
  return { ok: true };
}

export async function resubmitCustomAttackTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const { data: existing } = await supabase
    .from("custom_attack_tools")
    .select("code, network_allowed")
    .eq("id", toolId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Tool not found." };

  const audit = auditToolCode(String(existing.code ?? ""), Boolean(existing.network_allowed));
  if (audit.verdict === "rejected") {
    return {
      ok: false,
      error: `Static audit still rejects this probe (${audit.summary}). Edit the source before resubmitting.`,
    };
  }

  const { error } = await supabase
    .from("custom_attack_tools")
    .update({
      status: "pending",
      audit_result: audit.summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", toolId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[developer] resubmit error:", error);
    return { ok: false, error: "Could not resubmit tool." };
  }
  revalidatePath("/dashboard/developer");
  return { ok: true };
}

export async function saveToolVersion(
  toolId: string,
  code: string,
  changelog?: string,
): Promise<{ ok: boolean; error?: string; version?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tool } = await (supabase as any)
    .from("custom_attack_tools")
    .select("id, version, author_id, code")
    .eq("id", toolId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (!tool) return { ok: false, error: "Tool not found." };

  const currentVersion = (tool.version as number | undefined) ?? 1;
  const nextVersion = currentVersion + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: histErr } = await (supabase as any).from("custom_attack_tool_versions").insert({
    tool_id: toolId,
    version: currentVersion,
    code: tool.code,
    changelog: changelog ?? null,
    created_by: user.id,
  });

  if (histErr) {
    console.error("[developer] version history:", histErr);
    return { ok: false, error: "Could not save version history." };
  }

  const { error } = await (supabase as any)
    .from("custom_attack_tools")
    .update({ code, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", toolId)
    .eq("author_id", user.id);

  if (error) return { ok: false, error: "Could not update tool." };

  revalidatePath("/dashboard/developer");
  return { ok: true, version: nextVersion };
}

export async function publishApprovedToolToBazaar(
  toolId: string,
): Promise<{ ok: boolean; error?: string; scriptId?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const { data: tool } = await supabase
    .from("custom_attack_tools")
    .select("id, name, family, code, status, author_id, intensity_min")
    .eq("id", toolId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (!tool) return { ok: false, error: "Tool not found." };
  if (tool.status !== "approved") {
    return { ok: false, error: "Only approved tools can publish to Bazaar." };
  }

  const family = String(tool.family ?? "prompt");
  const tags = [family, String(tool.intensity_min ?? "standard")];

  const { data: script, error } = await supabase
    .from("bazaar_scripts")
    .insert({
      author_id: user.id,
      name: tool.name,
      title: tool.name,
      description: `Developer probe — ${family} module`,
      language: "python",
      tags,
      code: tool.code,
      code_content: tool.code,
      price_usd: 0,
      is_free: true,
      audit_verdict: "cleared",
      is_published: true,
      metadata: { source: "custom_attack_tools", tool_id: tool.id, module_category: family },
    })
    .select("id")
    .single();

  if (error || !script) {
    console.error("[developer] bazaar publish:", error);
    return { ok: false, error: error?.message ?? "Publish failed." };
  }

  revalidatePath("/dashboard/developer");
  revalidatePath("/dashboard/bazaar");
  return { ok: true, scriptId: script.id as string };
}
