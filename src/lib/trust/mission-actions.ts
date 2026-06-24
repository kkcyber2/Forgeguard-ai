"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { resolveVerifiedCompanyTag } from "@/lib/trust/identity";

export interface CreateMissionInput {
  title: string;
  description: string;
  scope?: string;
  budgetCredits: number;
  requiredRank: string;
}

export async function createMission(
  input: CreateMissionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || !description) {
    return { ok: false, error: "Title and description are required." };
  }

  const profile = await getCurrentProfile();
  const companyTag = resolveVerifiedCompanyTag({
    company_tag: profile?.company_tag,
    domain_verified: profile?.domain_verified,
    company_domain: profile?.company_domain,
  });

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("missions").insert({
    client_id: user.id,
    title,
    description,
    scope: input.scope?.trim() || null,
    budget_credits: Math.max(0, input.budgetCredits),
    required_rank: input.requiredRank,
    company_tag: companyTag,
    domain_verified: Boolean(profile?.domain_verified),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/missions");
  return { ok: true };
}
