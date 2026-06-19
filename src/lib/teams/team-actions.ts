"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { listFeed, type FeedPost } from "@/lib/social/feed-actions";

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  member_count?: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "team";
}

export async function listMyTeams(): Promise<TeamRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (supabase as any)
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id);

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
  if (!teamIds.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teams } = await (supabase as any)
    .from("teams")
    .select("id, name, slug, owner_id, created_at")
    .in("id", teamIds)
    .order("created_at", { ascending: false });

  return (teams ?? []) as TeamRow[];
}

export async function createTeam(name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Team name required" };

  const supabase = await createServerSupabase();
  const slug = `${slugify(trimmed)}-${user.id.slice(0, 6)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: team, error } = await (supabase as any)
    .from("teams")
    .insert({ name: trimmed, slug, owner_id: user.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await (supabase as any).from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "owner",
  });

  revalidatePath("/dashboard/intel");
  return { ok: true, id: team.id as string };
}

export async function inviteMember(
  teamId: string,
  email: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("team_invites")
    .insert({
      team_id: teamId,
      email: email.trim().toLowerCase(),
      created_by: user.id,
    })
    .select("token")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/intel");
  return { ok: true, token: data.token as string };
}

export async function joinTeam(token: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invite, error: invErr } = await (supabase as any)
    .from("team_invites")
    .select("team_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (invErr || !invite) return { ok: false, error: "Invalid invite" };
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, error: "Invite expired" };
  }

  const { error } = await (supabase as any).from("team_members").upsert({
    team_id: invite.team_id,
    user_id: user.id,
    role: "member",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/intel");
  return { ok: true };
}

export async function listTeamPosts(teamId: string): Promise<FeedPost[]> {
  return listFeed(30, teamId);
}

export async function listTeamMembers(teamId: string): Promise<Array<{ user_id: string; role: string }>> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId);

  return (data ?? []) as Array<{ user_id: string; role: string }>;
}
