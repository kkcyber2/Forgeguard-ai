import { connection } from "next/server";
import { HackerProfile } from "@/components/dashboard/hacker-profile";
import { normalizeHackerRankLabel } from "@/lib/access/ranks";
import { createServerSupabase } from "@/lib/supabase/server";

export async function OperatorLeaderboard({ limit = 8 }: { limit?: number }) {
  try {
    await connection();
    const supabase = await createServerSupabase();
    const { data: rows, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, hacker_rank, reputation, identity_verified, company_tag, domain_verified, clearance_tier",
      )
      .order("reputation", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[leaderboard] profiles:", error.message);
      return (
        <p className="py-6 text-center font-mono text-[10px] text-zinc-500">
          Leaderboard temporarily unavailable.
        </p>
      );
    }

    const operators = rows ?? [];

    if (operators.length === 0) {
      return (
        <p className="py-6 text-center font-mono text-[10px] text-zinc-500">
          No operators on the board yet.
        </p>
      );
    }

    return (
      <ol className="space-y-2">
        {operators.map((op, i) => (
          <li key={op.id} className="flex items-center gap-3">
            <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-600">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <HackerProfile
                fullName={op.full_name}
                email={op.email}
                hackerRank={normalizeHackerRankLabel(op.hacker_rank)}
                reputation={op.reputation ?? 0}
                identityVerified={op.identity_verified ?? false}
                companyTag={op.company_tag}
                domainVerified={op.domain_verified ?? false}
                clearanceTier={op.clearance_tier ?? undefined}
                compact
              />
            </div>
          </li>
        ))}
      </ol>
    );
  } catch (err) {
    console.error("[leaderboard] fetch:", err);
    return (
      <p className="py-6 text-center font-mono text-[10px] text-zinc-500">
        Leaderboard temporarily unavailable.
      </p>
    );
  }
}
