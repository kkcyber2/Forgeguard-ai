"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { useLiveAleRisk } from "@/hooks/use-live-ale-risk";
import { cn } from "@/lib/utils";

export function LiveAleRiskTile({
  userId,
  initialTotal,
}: {
  userId: string;
  initialTotal: number;
}) {
  const { total, pulseKey } = useLiveAleRisk(userId, initialTotal);

  return (
    <div
      key={pulseKey}
      className={cn(pulseKey > 0 && "[&>div]:animate-pulse-threat [&>div]:ring-1 [&>div]:ring-threat/30")}
    >
      <StatTile
        label="Total $ALE risk"
        value={total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
        tone={total > 50_000 ? "threat" : "neutral"}
        icon={DollarSign}
        footer={
          <Link
            href="/dashboard/scans"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 hover:text-white/70"
          >
            Financial risk · live heartbeat
          </Link>
        }
      />
    </div>
  );
}
