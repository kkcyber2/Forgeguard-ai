"use client";

import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankBadgeClass } from "@/lib/access/ranks";
import { VerifiedCheckmark, CompanyTagBadge } from "@/components/dashboard/verified-badge";

export interface IdentityBadgeProps {
  hackerRank: string | null;
  walletBalance: number;
  walletFrozen?: boolean;
  identityVerified?: boolean;
  companyTag?: string | null;
  domainVerified?: boolean;
}

export function IdentityBadge({
  hackerRank,
  walletBalance,
  walletFrozen = false,
  identityVerified = false,
  companyTag = null,
  domainVerified = false,
}: IdentityBadgeProps) {
  const rankLabel = (hackerRank ?? "RECRUIT").toUpperCase();

  return (
    <div className="hidden items-center gap-2 sm:flex">
      {identityVerified && <VerifiedCheckmark />}
      {domainVerified && companyTag && <CompanyTagBadge tag={companyTag} />}
      <span
        className={cn(
          "rounded-[3px] border-[0.5px] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
          rankBadgeClass(hackerRank),
        )}
        title="Operator rank"
      >
        {rankLabel}
      </span>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[3px] border-[0.5px] px-2 py-0.5",
          walletFrozen
            ? "border-red-400/25 bg-red-500/10"
            : "border-[#D1FF00]/25 bg-[#D1FF00]/[0.06]",
        )}
        title={walletFrozen ? "Wallet frozen" : "Wallet balance"}
      >
        <Coins
          size={10}
          strokeWidth={1.5}
          className={walletFrozen ? "text-red-400/70" : "text-[#D1FF00]"}
        />
        <span
          className={cn(
            "font-mono text-[10px] font-semibold tabular-nums",
            walletFrozen ? "text-red-400/80" : "text-[#D1FF00]",
          )}
        >
          ${walletBalance.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
