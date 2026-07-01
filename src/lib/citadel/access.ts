import "server-only";

import { redirect } from "next/navigation";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import {
  DEFAULT_COMPARTMENT_ID,
  type AgencyMember,
  type AgencyRole,
} from "@/lib/citadel/types";

export { DEFAULT_COMPARTMENT_ID };

/** Bootstrap sovereign operator as commander on first Citadel visit. */
export async function ensureAgencyBootstrap(
  userId: string,
  email: string | null | undefined,
): Promise<AgencyMember | null> {
  if (!isSovereignOperator(email)) return null;

  const admin = createAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from("agency_members")
    .select("*")
    .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as AgencyMember;

  const { data: inserted, error } = await db
    .from("agency_members")
    .insert({
      compartment_id: DEFAULT_COMPARTMENT_ID,
      user_id: userId,
      role: "commander" as AgencyRole,
      invited_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[citadel] ensureAgencyBootstrap failed:", error.message);
    return null;
  }

  await db.from("agency_audit_events").insert({
    compartment_id: DEFAULT_COMPARTMENT_ID,
    actor_id: userId,
    action: "bootstrap_commander",
    target_type: "member",
    target_id: inserted.id,
    meta: { email },
  });

  return inserted as AgencyMember;
}

export async function isAgencyMember(
  userId: string,
  compartmentId: string = DEFAULT_COMPARTMENT_ID,
): Promise<boolean> {
  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agency_members")
    .select("id")
    .eq("compartment_id", compartmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[citadel] isAgencyMember failed:", error.message);
    return false;
  }
  return Boolean(data);
}

export async function hasCitadelAccess(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  return isAgencyMember(userId);
}

export async function requireCitadelAccess(): Promise<{
  userId: string;
  email: string;
  member: AgencyMember;
}> {
  const user = await getSessionUser();
  if (!user?.email) redirect("/auth/login?next=/citadel");

  await ensureAgencyBootstrap(user.id, user.email);

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member, error } = await (supabase as any)
    .from("agency_members")
    .select("*")
    .eq("compartment_id", DEFAULT_COMPARTMENT_ID)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member) {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    email: user.email,
    member: member as AgencyMember,
  };
}

export async function requireCitadelCommander(): Promise<AgencyMember> {
  const { member } = await requireCitadelAccess();
  if (member.role !== "commander") {
    redirect("/citadel");
  }
  return member;
}
