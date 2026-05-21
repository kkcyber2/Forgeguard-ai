import { OperatorNameBadge } from "@/components/dashboard/verified-badge";
import { cn } from "@/lib/utils";
import { rankBadgeClass } from "@/lib/access/ranks";

export interface HackerProfileProps {
  fullName: string | null;
  email: string;
  hackerRank: string | null;
  reputation: number;
  identityVerified: boolean;
  companyTag: string | null;
  domainVerified: boolean;
  clearanceTier?: string;
  compact?: boolean;
}

export function HackerProfile({
  fullName,
  email,
  hackerRank,
  reputation,
  identityVerified,
  companyTag,
  domainVerified,
  clearanceTier,
  compact = false,
}: HackerProfileProps) {
  const display = fullName ?? email.split("@")[0];
  const rank = (hackerRank ?? "RECRUIT").toUpperCase();

  return (
    <div
      className={cn(
        "rounded-[4px] border-[0.5px] border-white/[0.08] bg-white/[0.02]",
        compact ? "px-3 py-2" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <OperatorNameBadge
            name={display}
            identityVerified={identityVerified}
            companyTag={companyTag}
            domainVerified={domainVerified}
          />
          {!compact && (
            <p className="mt-1 truncate font-mono text-[9px] text-zinc-500">{email}</p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-[3px] border-[0.5px] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]",
            rankBadgeClass(hackerRank),
          )}
        >
          {rank}
        </span>
      </div>
      {!compact && (
        <div className="mt-3 flex gap-4 font-mono text-[10px] text-zinc-400">
          <span>
            REP <span className="text-white tabular-nums">{reputation.toLocaleString()}</span>
          </span>
          {clearanceTier && (
            <span>
              CLR <span className="text-[#D1FF00] uppercase">{clearanceTier}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
