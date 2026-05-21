"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

/* ── submitProposal ─────────────────────────────────────────── */
export async function submitProposal({
  missionId,
  pitch,
  timeline,
  askCredits,
}: {
  missionId: string;
  pitch: string;
  timeline: string | null;
  askCredits: number;
}): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("mission_proposals").insert({
    mission_id: missionId,
    hacker_id: user.id,
    pitch,
    timeline,
    ask_credits: askCredits,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/missions/${missionId}`);
  return {};
}

/* ── acceptProposal ─────────────────────────────────────────── */
export async function acceptProposal({
  proposalId,
  missionId,
}: {
  proposalId: string;
  missionId: string;
}): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();

  // Verify ownership
  const { data: mission } = await supabase
    .from("missions")
    .select("id, client_id")
    .eq("id", missionId)
    .single();
  if (!mission || mission.client_id !== user.id) return { error: "Unauthorized." };

  // Fetch proposal to get hacker_id
  const { data: proposal } = await supabase
    .from("mission_proposals")
    .select("id, hacker_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposal not found." };

  // Accept this proposal, reject others
  await supabase
    .from("mission_proposals")
    .update({ status: "rejected" })
    .eq("mission_id", missionId)
    .neq("id", proposalId);

  await supabase
    .from("mission_proposals")
    .update({ status: "accepted" })
    .eq("id", proposalId);

  // Move mission to in_progress and assign hacker
  await supabase
    .from("missions")
    .update({ status: "in_progress", selected_hacker_id: proposal.hacker_id })
    .eq("id", missionId);

  revalidatePath(`/dashboard/missions/${missionId}`);
  revalidatePath("/dashboard/missions");
  return {};
}

/* ── rejectProposal ─────────────────────────────────────────── */
export async function rejectProposal({
  proposalId,
}: {
  proposalId: string;
}): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("mission_proposals")
    .update({ status: "rejected" })
    .eq("id", proposalId);

  if (error) return { error: error.message };
  return {};
}

/* ── sendMissionMessage ─────────────────────────────────────── */
export async function sendMissionMessage({
  missionId,
  body,
}: {
  missionId: string;
  body: string;
}): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };
  if (!body.trim()) return { error: "Empty message." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("mission_messages").insert({
    mission_id: missionId,
    sender_id: user.id,
    body: body.trim(),
  });

  if (error) return { error: error.message };
  return {};
}
