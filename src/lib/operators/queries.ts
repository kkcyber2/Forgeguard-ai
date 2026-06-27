import { createServerSupabase } from "@/lib/supabase/server";

export interface OperatorProfile {
  id: string;
  full_name: string | null;
  hacker_rank: string | null;
  company_tag: string | null;
  domain_verified: boolean | null;
  company_domain: string | null;
  work_email_verified: boolean | null;
  identity_verified: boolean | null;
  sovereign_pending: boolean | null;
  clearance_tier: string | null;
  reputation: number | null;
  bio: string | null;
  avatar_url: string | null;
  job_title: string | null;
  created_at: string | null;
}

export interface OperatorStats {
  ctf_solves: number;
  ctf_points: number;
  bazaar_scripts: number;
  bounty_count: number;
}

export async function fetchOperatorProfile(
  id: string,
): Promise<OperatorProfile | null> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("profiles_public")
    .select(
      "id, full_name, hacker_rank, company_tag, domain_verified, company_domain, work_email_verified, identity_verified, sovereign_pending, clearance_tier, reputation, bio, avatar_url, job_title, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as OperatorProfile;
}

export async function fetchOperatorStats(
  id: string,
): Promise<OperatorStats> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("operator_public_stats", {
    p_user_id: id,
  });

  if (error || !data) {
    return { ctf_solves: 0, ctf_points: 0, bazaar_scripts: 0, bounty_count: 0 };
  }
  return {
    ctf_solves: Number(data.ctf_solves ?? 0),
    ctf_points: Number(data.ctf_points ?? 0),
    bazaar_scripts: Number(data.bazaar_scripts ?? 0),
    bounty_count: Number(data.bounty_count ?? 0),
  };
}
