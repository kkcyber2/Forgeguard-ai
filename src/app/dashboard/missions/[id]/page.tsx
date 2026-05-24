import * as React from "react";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Coins, ShieldCheck, BadgeCheck, Users } from "lucide-react";
import Link from "next/link";
import { createServerSupabase, getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { ProposalForm } from "@/components/missions/proposal-form";
import { ProposalList } from "@/components/missions/proposal-list";
import { MissionChat } from "@/components/missions/mission-chat";
import { CompleteMissionButton } from "@/components/missions/complete-mission-button";

/**
 * /dashboard/missions/[id] — Mission detail page
 * ────────────────────────────────────────────────
 * • Clients  → see all proposals, accept/reject, and chat with the selected operator
 * • Hackers  → see mission brief + submit one proposal (if open), and chat if selected
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MissionDetailPage({ params }: Props) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?next=/dashboard/missions/${id}`);

  const profile = await getCurrentProfile();
  const userType = profile?.user_type ?? "hacker";
  const isClient = userType === "client";

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch mission
  const { data: missionRaw, error } = await db
    .from("missions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !missionRaw) return notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mission = missionRaw as any;

  const isOwner = mission.client_id === user.id;
  const isSelectedHacker = mission.selected_hacker_id === user.id;
  const canChat = isOwner || isSelectedHacker;

  // Fetch proposals (clients see all; hackers see their own)
  const proposalQuery = db
    .from("mission_proposals")
    .select("id, hacker_id, pitch, timeline, ask_credits, status, created_at")
    .eq("mission_id", id)
    .order("created_at", { ascending: false });

  const { data: proposalsRaw } = isOwner
    ? await proposalQuery
    : await proposalQuery.eq("hacker_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposals = (proposalsRaw ?? []) as any[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myProposal = !isOwner ? proposals?.find((p: any) => p.hacker_id === user.id) : undefined;
  const hasProposed = !!myProposal;

  // Initial messages for the chat
  const { data: messagesRaw } = canChat
    ? await db
        .from("mission_messages")
        .select("id, sender_id, body, created_at")
        .eq("mission_id", id)
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: [] };

  const initialMessages = (messagesRaw ?? []).map(
    (m: { id: string; sender_id: string; body: string; created_at: string }) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      isOwn: m.sender_id === user.id,
    }),
  );

  const senderIds = [...new Set(initialMessages.map((m: { senderId: string }) => m.senderId))];
  const { data: senderProfiles } =
    senderIds.length > 0
      ? await db
          .from("profiles")
          .select("id, full_name, hacker_rank, identity_verified, company_tag, domain_verified")
          .in("id", senderIds)
      : { data: [] };

  const initialSenders: Record<
    string,
    {
      fullName: string | null;
      hackerRank: string;
      identityVerified: boolean;
      companyTag: string | null;
      domainVerified: boolean;
    }
  > = {};
  for (const p of senderProfiles ?? []) {
    initialSenders[p.id] = {
      fullName: p.full_name,
      hackerRank: p.hacker_rank ?? "RECRUIT",
      identityVerified: p.identity_verified ?? false,
      companyTag: p.company_tag,
      domainVerified: p.domain_verified ?? false,
    };
  }

  const RANK_COLORS: Record<string, string> = {
    RECRUIT:   "rgba(255,255,255,0.35)",
    OPERATIVE: "#38BDF8",
    ELITE:     "#D1FF00",
    SOVEREIGN: "#8B5CF6",
  };
  const rankColor = RANK_COLORS[mission.required_rank as string] ?? "rgba(255,255,255,0.35)";

  return (
    <div className="mx-auto max-w-4xl px-0 pb-16">
      {/* Back */}
      <Link
        href="/dashboard/missions"
        className="mb-6 flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
        Mission Vault
      </Link>

      {/* ── Mission brief ────────────────────────────────── */}
      <div
        className="mb-6 rounded-[4px] p-6"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Header row */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {mission.company_tag && (
              <span
                className="mb-2 flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-[3px]"
                style={{
                  background: "rgba(56,189,248,0.1)",
                  border: "0.5px solid rgba(56,189,248,0.3)",
                  color: "#38BDF8",
                }}
              >
                {mission.domain_verified && <BadgeCheck size={10} strokeWidth={2} />}
                [{mission.company_tag}]
              </span>
            )}
            <h1 className="text-xl font-semibold text-white">{mission.title}</h1>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.15em]"
              style={{ color: mission.status === "open" ? "#D1FF00" : "rgba(255,255,255,0.3)" }}
            >
              ● {mission.status?.toUpperCase()}
            </span>
            {isOwner && mission.status === "in_progress" && (
              <CompleteMissionButton missionId={id} />
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          {mission.description}
        </p>

        {/* Scope */}
        {mission.scope && (
          <div className="mb-5 rounded-[3px] p-4" style={{ background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Scope / Rules of Engagement
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.5)" }}>
              {mission.scope}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Coins size={14} style={{ color: "#D1FF00", opacity: 0.8 }} strokeWidth={1.5} />
            <span className="font-mono text-sm font-semibold" style={{ color: "#D1FF00" }}>
              {(mission.budget_credits as number).toLocaleString()} credits
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} style={{ color: rankColor }} strokeWidth={1.5} />
            <span className="font-mono text-xs uppercase tracking-wider" style={{ color: rankColor }}>
              {mission.required_rank}+ required
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={13} style={{ color: "rgba(255,255,255,0.3)" }} strokeWidth={1.5} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {proposals?.length ?? 0} proposal{(proposals?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: proposals + chat ─────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: proposals */}
        <div className="flex flex-col gap-4">
          {/* Hacker → submit proposal form if open and not yet submitted */}
          {!isClient && !isOwner && mission.status === "open" && !hasProposed && (
            <ProposalForm missionId={id} />
          )}

          {/* Show existing proposals */}
          {(isOwner || (!isClient && hasProposed)) && (
            <ProposalList
              missionId={id}
              proposals={proposals}
              isOwner={isOwner}
              missionStatus={mission.status as string}
            />
          )}

          {/* Hacker: pending proposal status */}
          {!isOwner && hasProposed && myProposal && (
            <div
              className="rounded-[4px] p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.07)",
              }}
            >
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Your Proposal
              </p>
              <p className="mb-2 text-sm text-white">{myProposal.pitch}</p>
              <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {myProposal.timeline && <span>⏱ {myProposal.timeline}</span>}
                {myProposal.ask_credits > 0 && (
                  <span style={{ color: "#D1FF00" }}>
                    {myProposal.ask_credits.toLocaleString()} credits
                  </span>
                )}
                <span
                  className="ml-auto font-mono text-[9px] uppercase tracking-[0.15em]"
                  style={{
                    color: myProposal.status === "accepted" ? "#D1FF00"
                      : myProposal.status === "rejected" ? "rgba(255,100,100,0.7)"
                      : "rgba(255,255,255,0.3)",
                  }}
                >
                  {myProposal.status}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: real-time DM chat (only for mission participants) */}
        {canChat ? (
          <MissionChat
            missionId={id}
            currentUserId={user.id}
            initialMessages={initialMessages}
            initialSenders={initialSenders}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-[4px] p-8 text-center"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              minHeight: 200,
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
              Mission Chat
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              Available after the client accepts your proposal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
