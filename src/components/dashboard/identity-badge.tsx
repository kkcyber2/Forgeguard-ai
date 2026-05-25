"use client";

import { cn } from "@/lib/utils";
import { normalizeHackerRankLabel, rankBadgeClass } from "@/lib/access/ranks";
import { VerifiedCheckmark, CompanyTagBadge } from "@/components/dashboard/verified-badge";
import { WalletCredits } from "@/components/dashboard/wallet-credits";
import type { LiveWalletState } from "@/hooks/use-live-wallet";
import type { ViewMode } from "@/lib/access/parallel-sovereignty";

export interface IdentityBadgeProps {
  hackerRank: string | number | null;
  walletBalance: number;
  wallet?: LiveWalletState;
  walletFrozen?: boolean;
  identityVerified?: boolean;
  companyTag?: string | null;
  domainVerified?: boolean;
  viewMode?: ViewMode;
  trustScore?: number;
}

export function IdentityBadge({
  hackerRank,
  walletBalance,
  wallet,
  walletFrozen = false,
  identityVerified = false,
  companyTag = null,
  domainVerified = false,
  viewMode = "hacker",
  trustScore = 0,
}: IdentityBadgeProps) {
  const rankLabel = normalizeHackerRankLabel(hackerRank);
  const isClient = viewMode === "client";

  return (
    <div className="hidden items-center gap-2 md:flex">
      {identityVerified && <VerifiedCheckmark />}
      {domainVerified && companyTag && <CompanyTagBadge tag={companyTag} />}
      {isClient ? (
        <span
          className="rounded-[3px] border-[0.5px] border-violet-400/35 bg-violet-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-violet-300"
          title="Trust tier from operator rank (0 if unranked)"
        >
          Trust {trustScore}
        </span>
      ) : (
        <span
          className={cn(
            "rounded-[3px] border-[0.5px] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
            rankBadgeClass(hackerRank),
          )}
          title="Operator rank"
        >
          {rankLabel}
        </span>
      )}
      {walletFrozen ? (
        <WalletCredits
          initialBalance={walletBalance}
          wallet={wallet}
          className="border-red-400/25 bg-red-500/10"
        />
      ) : (
        <WalletCredits initialBalance={walletBalance} wallet={wallet} className="px-2 py-0.5" />
      )}
    </div>
  );
}
