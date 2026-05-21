/**
 * IdentityPanel — Dual-identity hero strip for the dashboard overview.
 *
 * CLIENT  (access_level = 1): Shows Aegis rule count + active bounties.
 * HACKER  (access_level ≥ 2): Shows hacker rank badge + reputation + missions.
 * Unknown / pending:           Shows a prompt to complete identity verification.
 */

import * as React from "react";
import Link from "next/link";
import { OperatorNameBadge } from "@/components/dashboard/verified-badge";
import {
  Award,
  ChevronRight,
  Globe,
  Shield,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface IdentityPanelProps {
  userType: "client" | "hacker" | "developer" | null;
  accessLevel: number;
  hackerRank: string | null;
  reputation: number;
  missionsCompleted: number;
  openBounties: number;
  aegisRules: number;
  domainVerified: boolean;
  identityVerified?: boolean;
  companyTag?: string | null;
  fullName?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Rank config                                                                 */
/* -------------------------------------------------------------------------- */

const RANK_CONFIG: Record<
  string,
  { label: string; color: string; glow: string; description: string }
> = {
  GHOST:    { label: "GHOST",    color: "text-white/60",    glow: "shadow-white/10",   description: "Untracked. No signature." },
  PHANTOM:  { label: "PHANTOM",  color: "text-blue-400",    glow: "shadow-blue-400/20",description: "Verified operator. Missions unlocked." },
  SENTINEL: { label: "SENTINEL", color: "text-[#D1FF00]",   glow: "shadow-[#D1FF00]/20",description: "Elite tier. Full arsenal access." },
  TRAITOR:  { label: "TRAITOR",  color: "text-red-400",     glow: "shadow-red-400/30", description: "Account frozen. Wallet locked." },
};

function getRank(rank: string | null) {
  if (!rank) return RANK_CONFIG.GHOST!;
  return RANK_CONFIG[rank.toUpperCase()] ?? RANK_CONFIG.GHOST!;
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function StatCell({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[3px] border-[0.5px] border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <Icon
        size={12}
        strokeWidth={1.5}
        className={cn("flex-shrink-0", accent ? "text-[#D1FF00]" : "text-white/30")}
      />
      <p className={cn("font-mono text-xl font-light tabular-nums", accent ? "text-[#D1FF00]" : "text-white")}>
        {value}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">{label}</p>
    </div>
  );
}

/* ── Hacker panel ─────────────────────────────────────────────────────────── */

function HackerPanel({
  hackerRank,
  reputation,
  missionsCompleted,
  accessLevel,
  identityVerified,
  companyTag,
  domainVerified,
  fullName,
}: Pick<
  IdentityPanelProps,
  | "hackerRank"
  | "reputation"
  | "missionsCompleted"
  | "accessLevel"
  | "identityVerified"
  | "companyTag"
  | "domainVerified"
  | "fullName"
>) {
  const rank = getRank(hackerRank);
  const isTraitor = hackerRank?.toUpperCase() === "TRAITOR";

  return (
    <div
      className={cn(
        "rounded-[4px] border-[0.5px] p-5",
        isTraitor
          ? "border-red-400/25 bg-red-500/[0.04]"
          : "border-white/[0.07] bg-white/[0.02]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/25">
            Operator Identity
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={cn(
                "font-mono text-2xl font-light tracking-widest",
                rank.color,
              )}
            >
              {rank.label}
            </span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isTraitor ? "bg-red-400" : "bg-[#D1FF00] shadow-[0_0_8px_rgba(209,255,0,0.6)]",
              )}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-white/35">{rank.description}</p>
          {fullName && (
            <div className="mt-2">
              <OperatorNameBadge
                name={fullName}
                identityVerified={identityVerified}
                companyTag={companyTag}
                domainVerified={domainVerified}
              />
            </div>
          )}
        </div>

        <Link
          href="/dashboard/missions"
          className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
        >
          Missions
          <ChevronRight size={10} strokeWidth={2} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatCell
          label="Reputation"
          value={reputation.toLocaleString()}
          icon={TrendingUp}
          accent
        />
        <StatCell
          label="Missions"
          value={missionsCompleted}
          icon={Target}
        />
        <StatCell
          label="Access Tier"
          value={`L${accessLevel}`}
          icon={Zap}
          accent={accessLevel >= 3}
        />
      </div>

      {isTraitor && (
        <div className="mt-3 flex items-center gap-2 rounded-[3px] border-[0.5px] border-red-400/30 bg-red-500/10 px-3 py-2">
          <Shield size={12} strokeWidth={1.5} className="text-red-400 flex-shrink-0" />
          <p className="font-mono text-[10px] text-red-300/80">
            Your account has been flagged. Wallet frozen. Contact support to dispute.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Client panel ─────────────────────────────────────────────────────────── */

function ClientPanel({
  aegisRules,
  openBounties,
  domainVerified,
}: Pick<IdentityPanelProps, "aegisRules" | "openBounties" | "domainVerified">) {
  return (
    <div className="rounded-[4px] border-[0.5px] border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/25">
            Client Command Center
          </p>
          <p className="mt-2 font-mono text-[11px] tracking-wide text-white/60">
            Your protection posture and managed bounty programs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {domainVerified ? (
            <span className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-[#D1FF00]/30 bg-[#D1FF00]/[0.06] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#D1FF00]/80">
              <ShieldCheck size={10} strokeWidth={2} />
              Verified
            </span>
          ) : (
            <Link
              href="/dashboard/settings#domain"
              className="flex items-center gap-1.5 rounded-[3px] border-[0.5px] border-orange-400/30 bg-orange-500/[0.06] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-orange-400/80 transition-colors hover:border-orange-400/50"
            >
              <Globe size={10} strokeWidth={2} />
              Verify Domain
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatCell
          label="Aegis Rules"
          value={aegisRules}
          icon={ShieldCheck}
          accent={aegisRules > 0}
        />
        <StatCell
          label="Open Bounties"
          value={openBounties}
          icon={Award}
        />
        <StatCell
          label="Coverage"
          value={aegisRules > 0 ? "Active" : "None"}
          icon={Swords}
          accent={aegisRules > 0}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/aegis"
          className="flex items-center justify-between rounded-[3px] border-[0.5px] border-white/[0.07] px-3 py-2 text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">Manage Rules</span>
          <ChevronRight size={11} strokeWidth={1.5} />
        </Link>
        <Link
          href="/dashboard/bounties"
          className="flex items-center justify-between rounded-[3px] border-[0.5px] border-white/[0.07] px-3 py-2 text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">Post Bounty</span>
          <ChevronRight size={11} strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

/* ── Unverified prompt ────────────────────────────────────────────────────── */

function VerifyPrompt() {
  return (
    <div className="flex items-center justify-between rounded-[4px] border-[0.5px] border-orange-400/25 bg-orange-500/[0.04] px-5 py-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-400/70">
          Identity Pending
        </p>
        <p className="mt-1 font-mono text-[11px] text-white/50">
          Complete your identity verification to unlock your full operator dashboard.
        </p>
      </div>
      <Link
        href="/auth/signup/identity"
        className="flex-shrink-0 rounded-[3px] border-[0.5px] border-orange-400/40 bg-orange-500/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-orange-400/90 transition-colors hover:bg-orange-500/15"
      >
        Set Identity
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main export                                                                 */
/* -------------------------------------------------------------------------- */

export function IdentityPanel(props: IdentityPanelProps) {
  const { userType, accessLevel } = props;

  if (!userType) return <VerifyPrompt />;

  if (userType === "client" && accessLevel === 1) {
    return (
      <ClientPanel
        aegisRules={props.aegisRules}
        openBounties={props.openBounties}
        domainVerified={props.domainVerified}
      />
    );
  }

  // hacker | developer (accessLevel ≥ 2)
  return (
    <HackerPanel
      hackerRank={props.hackerRank}
      reputation={props.reputation}
      missionsCompleted={props.missionsCompleted}
      accessLevel={accessLevel}
      identityVerified={props.identityVerified}
      companyTag={props.companyTag}
      domainVerified={props.domainVerified}
      fullName={props.fullName}
    />
  );
}
