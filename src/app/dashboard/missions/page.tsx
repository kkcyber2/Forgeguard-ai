import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  Crosshair,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  Shield,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase, getSessionUser, getCurrentProfile } from "@/lib/supabase/server";
import { VerifiedCheckmark, CompanyTagBadge } from "@/components/dashboard/verified-badge";

/**
 * /dashboard/missions — Mission Vault
 * Stronghold 2.0 — High-density Operations layout.
 * Small text, sharp 0.5px borders, lots of data density.
 * Acid green for live/open, white/20 for closed.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ── Status badge ──────────────────────────────────────────────────── */
function StatusChip({ status }: { status: string }) {
  if (status === "open")
    return (
      <span className="inline-flex items-center gap-1 rounded-[2px] border border-[#D1FF00]/20 bg-[#D1FF00]/5 px-1.5 py-0.5">
        <span className="h-1 w-1 rounded-full bg-[#D1FF00] shadow-[0_0_4px_rgba(209,255,0,0.8)]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#D1FF00]">Open</span>
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="inline-flex items-center gap-1 rounded-[2px] border border-blue-400/20 bg-blue-400/5 px-1.5 py-0.5">
        <span className="h-1 w-1 rounded-full bg-blue-400" />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-blue-400">Active</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-[2px] border border-white/10 bg-white/[0.02] px-1.5 py-0.5">
      <span className="h-1 w-1 rounded-full bg-white/30" />
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">Closed</span>
    </span>
  );
}

/* ── Rank badge ────────────────────────────────────────────────────── */
function RankChip({ rank }: { rank: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    GHOST:    { label: "GHOST",    color: "text-violet-400 border-violet-400/20 bg-violet-400/5" },
    PHANTOM:  { label: "PHANTOM",  color: "text-purple-400 border-purple-400/20 bg-purple-400/5" },
    SENTINEL: { label: "SENTINEL", color: "text-sky-400 border-sky-400/20 bg-sky-400/5"     },
    TRAITOR:  { label: "TRAITOR",  color: "text-red-400 border-red-400/20 bg-red-400/5"       },
  };
  const style = map[rank ?? ""] ?? { label: rank ?? "ANY", color: "text-white/40 border-white/10 bg-white/[0.02]" };
  return (
    <span className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] ${style.color}`}>
      {style.label}
    </span>
  );
}

/* ── Mission row ───────────────────────────────────────────────────── */
function MissionRow({
  m,
  isOwner,
  userId,
  clientProfile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m: any;
  isOwner: boolean;
  userId: string;
  clientProfile?: {
    identity_verified?: boolean;
    company_tag?: string | null;
    domain_verified?: boolean;
    full_name?: string | null;
  };
}) {
  const created = new Date(m.created_at);
  const age = Math.floor((Date.now() - created.getTime()) / 86_400_000);

  return (
    <Link
      href={`/dashboard/missions/${m.id}`}
      className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-3 transition-all hover:bg-white/[0.02]"
    >
      {/* Left — main info */}
      <div className="min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12px] font-medium tracking-wide text-white/90 group-hover:text-white">
            {m.title}
          </span>
          {clientProfile?.identity_verified && (
            <VerifiedCheckmark className="flex-shrink-0" />
          )}
          {(m.domain_verified || clientProfile?.domain_verified) && m.company_tag && (
            <CompanyTagBadge tag={m.company_tag as string} />
          )}
          {m.domain_verified && !m.company_tag && (
            <Shield size={9} className="flex-shrink-0 text-[#D1FF00]" />
          )}
          {isOwner && (
            <span className="flex-shrink-0 font-mono text-[9px] tracking-[0.15em] text-white/40">
              MINE
            </span>
          )}
        </div>

        {/* Description — single line */}
        {m.description && (
          <p className="mt-0.5 truncate font-mono text-[10px] text-white/30">
            {m.description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusChip status={m.status} />
          <RankChip rank={m.required_rank} />
          {m.company_tag && (
            <span className="font-mono text-[9px] tracking-wider text-white/25">
              {m.company_tag}
            </span>
          )}
          <span className="flex items-center gap-1 font-mono text-[9px] text-white/40">
            <Clock size={8} />
            {age === 0 ? "Today" : `${age}d ago`}
          </span>
        </div>
      </div>

      {/* Right — budget + chevron */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {m.budget_credits != null && (
          <div className="text-right">
            <p className="font-mono text-[13px] font-semibold tabular-nums text-[#D1FF00]">
              {Number(m.budget_credits).toLocaleString()}
            </p>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/25">
              Credits
            </p>
          </div>
        )}
        <ChevronRight size={12} className="text-white/40 transition-colors group-hover:text-white/50" />
      </div>
    </Link>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default async function MissionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/missions");

  const profile = await getCurrentProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessLevel = ((profile as any)?.access_level as number | null) ?? 1;
  const isClient = accessLevel === 1;

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: clientProfiles } = await db
    .from("profiles")
    .select("id, identity_verified, company_tag, domain_verified, full_name")
    .limit(500);

  const clientMap = new Map((clientProfiles ?? []).map((p) => [p.id, p]));

  const query = db
    .from("missions")
    .select(
      "id, title, description, budget_credits, required_rank, company_tag, domain_verified, status, created_at, client_id",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const { data, error } = isClient
    ? await query.eq("client_id", user.id)
    : await query.eq("status", "open");

  if (error) console.error("[missions] list:", error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missions = (data ?? []) as any[];

  /* ── Derived stats ── */
  const openCount   = missions.filter((m) => m.status === "open").length;
  const activeCount = missions.filter((m) => m.status === "in_progress").length;
  const totalCredits = missions.reduce(
    (acc: number, m: any) => acc + (Number(m.budget_credits) || 0),
    0,
  );

  return (
    <div className="space-y-0">
      {/* ── Header bar ── */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/25">
            Mission Vault
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-white">
            Operations
          </h1>
        </div>
        {isClient && (
          <Link
            href="/dashboard/missions/new"
            className={buttonStyles({
              size: "sm",
              className:
                "border-[0.5px] border-white/10 bg-white/[0.04] font-mono text-[10px] uppercase tracking-widest text-white/70 hover:border-white/20 hover:text-white",
            })}
          >
            <Plus size={11} strokeWidth={1.5} />
            New Mission
          </Link>
        )}
      </div>

      {/* ── Stat strip ── */}
      <div className="mb-4 grid grid-cols-3 divide-x divide-white/[0.06] border border-white/[0.06] bg-white/[0.01]">
        {[
          { label: "Open Contracts", value: openCount, icon: Circle, color: "text-[#D1FF00]" },
          { label: "Active Ops", value: activeCount, icon: Zap, color: "text-blue-400" },
          { label: "Credit Pool", value: totalCredits.toLocaleString(), icon: AlertTriangle, color: "text-white/50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon size={14} className={color} strokeWidth={1.5} />
            <div>
              <p className={`font-mono text-sm font-semibold tabular-nums ${color}`}>
                {value}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="border border-white/[0.06] bg-[#050505]">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/[0.06] px-4 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
            Mission
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
            Reward
          </span>
        </div>

        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Crosshair size={28} strokeWidth={1} className="text-white/30" />
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              {isClient ? "No missions posted" : "No open contracts"}
            </p>
            {isClient && (
              <Link
                href="/dashboard/missions/new"
                className={buttonStyles({
                  size: "sm",
                  className:
                    "mt-2 border-[0.5px] border-white/10 bg-transparent font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70",
                })}
              >
                Post your first mission
              </Link>
            )}
          </div>
        ) : (
          missions.map((m: any) => (
            <MissionRow
              key={m.id}
              m={m}
              isOwner={m.client_id === user.id}
              userId={user.id}
              clientProfile={clientMap.get(m.client_id as string)}
            />
          ))
        )}
      </div>

      {/* ── Footer count ── */}
      {missions.length > 0 && (
        <div className="border-x border-b border-white/[0.06] px-4 py-2">
          <p className="font-mono text-[9px] text-white/40">
            {missions.length} record{missions.length !== 1 ? "s" : ""} — sorted by newest
          </p>
        </div>
      )}
    </div>
  );
}
