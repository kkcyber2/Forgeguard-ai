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

export async function createCustomAttackTool(
  _prev: ToolFormState,
  formData: FormData,
): Promise<ToolFormState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("id", user.id)
    .maybeSingle();
  const accessLevel = (profile?.access_level as number | undefined) ?? 1;
  const sovereign = isSovereignOperator(user.email);
  if (!sovereign && accessLevel < 2) {
    return { ok: false, error: "Rank 2+ required to author attack tools." };
  }

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

  const { error } = await supabase
    .from("custom_attack_tools")
    .update({ status: "pending", audit_result: "resubmitted by author", updated_at: new Date().toISOString() })
    .eq("id", toolId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[developer] resubmit error:", error);
    return { ok: false, error: "Could not resubmit tool." };
  }
  revalidatePath("/dashboard/developer");
  return { ok: true };
}
