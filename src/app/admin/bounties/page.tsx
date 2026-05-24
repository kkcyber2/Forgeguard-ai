import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { ReleaseFundsButton } from "./release-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata = { title: "Bounty Escrow" };

export default async function AdminBountiesPage() {
  if (!(await requireAdminProfile())) redirect("/dashboard");

  const db = createAdminSupabase();
  const { data: escrows } = await db
    .from("bounty_escrow")
    .select("id, user_id, amount_usd, status, held_at, submission_id, mission_id")
    .eq("status", "held")
    .order("held_at", { ascending: false })
    .limit(100);

  const rows = escrows ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const missionIds = [...new Set(rows.map((r) => r.mission_id).filter(Boolean) as string[])];
  const { data: missions } = missionIds.length
    ? await db.from("missions").select("id, title").in("id", missionIds)
    : { data: [] };
  const missionMap = new Map((missions ?? []).map((m) => [m.id, m]));

  return (
    <>
      <PageHeader
        eyebrow="Admin · Economy"
        title="Bounty escrow"
        description="Release held funds to operator wallets after triage approval."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowLeft}
          title="No held escrows"
          description="All bounty escrows are released or empty."
        />
      ) : (
        <div className="overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.08]">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-3 text-left">Hacker</th>
                <th className="px-4 py-3 text-left">Mission</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Held</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = profileMap.get(row.user_id);
                const mission = row.mission_id ? missionMap.get(row.mission_id) : null;
                return (
                  <tr key={row.id} className="border-b border-white/[0.05]">
                    <td className="px-4 py-3">
                      <p className="text-white/90">{p?.full_name ?? "—"}</p>
                      <p className="text-zinc-500">{p?.email ?? row.user_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {mission?.title ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#D1FF00] tabular-nums">
                      ${Number(row.amount_usd).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(row.held_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReleaseFundsButton escrowId={row.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
