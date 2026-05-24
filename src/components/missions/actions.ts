"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
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

  const { data: missionFull } = await supabase
    .from("missions")
    .select("budget_credits")
    .eq("id", missionId)
    .single();

  const amount = Number(missionFull?.budget_credits ?? 0);
  if (amount > 0) {
    const admin = createAdminSupabase();
    await admin.from("bounty_escrow").insert({
      mission_id: missionId,
      user_id: proposal.hacker_id,
      submission_id: missionId,
      amount_usd: amount,
      status: "held",
    });
  }

  revalidatePath(`/dashboard/missions/${missionId}`);
  revalidatePath("/dashboard/missions");
  return {};
}

/* ── completeMission — release escrow to hacker wallet ─────── */
export async function completeMission(
  missionId: string,
): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabase();
  const { data: mission } = await supabase
    .from("missions")
    .select("id, client_id, status, selected_hacker_id, budget_credits")
    .eq("id", missionId)
    .single();

  if (!mission || mission.client_id !== user.id) return { error: "Unauthorized." };
  if (mission.status !== "in_progress") return { error: "Mission is not in progress." };
  if (!mission.selected_hacker_id) return { error: "No operator assigned." };

  const admin = createAdminSupabase();

  const { data: escrow } = await admin
    .from("bounty_escrow")
    .select("id, amount_usd, status")
    .eq("mission_id", missionId)
    .eq("user_id", mission.selected_hacker_id)
    .maybeSingle();

  const amount = Number(escrow?.amount_usd ?? mission.budget_credits ?? 0);
  const hackerId = mission.selected_hacker_id;

  await admin.from("user_wallets").upsert({ user_id: hackerId }, { onConflict: "user_id" });

  const { error: creditErr } = await admin.rpc("increment_wallet", {
    p_user_id: hackerId,
    p_amount: amount,
  });
  if (creditErr) return { error: creditErr.message };

  if (escrow) {
    await admin
      .from("bounty_escrow")
      .update({
        status: "released",
        released_at: new Date().toISOString(),
        release_note: "Mission approved by client",
      })
      .eq("id", escrow.id);
  }

  await admin.from("platform_transactions").insert({
    buyer_id: user.id,
    seller_id: hackerId,
    amount_usd: amount,
    amount_credits: Math.round(amount),
    author_payout: amount,
    platform_fee: 0,
    tx_type: "bounty_release",
  });

  await supabase
    .from("missions")
    .update({ status: "completed" })
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
