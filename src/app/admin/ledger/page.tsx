import Link from "next/link";
import { ArrowLeft, Landmark, Lock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { PayoutButton } from "./payout-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata = { title: "Financial Ledger" };

const TX_LABELS: Record<string, string> = {
  bazaar_purchase: "Bazaar purchase",
  bounty_release: "Bounty release",
  kinetic_bounty_paid: "Kinetic bounty paid",
  escrow_hold: "Escrow hold",
  top_up: "Top-up",
  refund: "Refund",
};

export default async function AdminLedgerPage() {
  if (!(await requireAdminProfile())) redirect("/dashboard");

  const db = createAdminSupabase();

  const [{ data: escrows }, { data: transactions }, { data: wallets }, { data: hackerWallets }] =
    await Promise.all([
    db
      .from("bounty_escrow")
      .select("id, user_id, amount_usd, status, held_at, mission_id, submission_id")
      .eq("status", "held")
      .order("held_at", { ascending: false })
      .limit(50),
    db
      .from("platform_transactions")
      .select("id, buyer_id, seller_id, amount_usd, platform_fee, tx_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("user_wallets").select("balance_usd"),
    db.from("hacker_wallets").select("credits"),
  ]);

  const heldRows = escrows ?? [];
  const txRows = transactions ?? [];
  const totalHeld = heldRows.reduce((sum, r) => sum + Number(r.amount_usd), 0);
  const totalHackerCredits = (hackerWallets ?? []).reduce(
    (sum, w) => sum + Number(w.credits ?? 0),
    0,
  );
  const totalCirculation = (wallets ?? []).reduce(
    (sum, w) => sum + Number(w.balance_usd ?? 0),
    0,
  );

  const userIds = [
    ...new Set([
      ...heldRows.map((r) => r.user_id),
      ...txRows.flatMap((t) => [t.buyer_id, t.seller_id].filter(Boolean) as string[]),
    ]),
  ];

  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };

  const missionIds = [...new Set(heldRows.map((r) => r.mission_id).filter(Boolean) as string[])];
  const { data: missions } = missionIds.length
    ? await db.from("missions").select("id, title, client_id").in("id", missionIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const missionMap = new Map((missions ?? []).map((m) => [m.id, m]));

  return (
    <>
      <PageHeader
        eyebrow="Admin · Treasury"
        title="Financial ledger"
        description="Escrow holds, wallet circulation, and atomic payout releases."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Held in escrow"
          value={`$${totalHeld.toFixed(2)}`}
          tone="threat"
          icon={Lock}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
              {heldRows.length} active hold{heldRows.length !== 1 ? "s" : ""}
            </span>
          }
        />
        <StatTile
          label="Hacker credits"
          value={totalHackerCredits.toLocaleString()}
          tone="secure"
          icon={Landmark}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
              {(hackerWallets ?? []).length} researcher wallets
            </span>
          }
        />
        <StatTile
          label="USD circulation"
          value={`$${totalCirculation.toFixed(2)}`}
          tone="neutral"
          icon={Landmark}
          footer={
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
              {(wallets ?? []).length} client wallets
            </span>
          }
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Escrow holds — sovereign payout (10% platform fee)
        </h2>
        {heldRows.length === 0 ? (
          <EmptyState
            icon={Lock}
            title="No held escrows"
            description="Mission assignments debit client wallets into escrow. Releases appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.08]">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-3 text-left">Operator</th>
                  <th className="px-4 py-3 text-left">Mission</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Held</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {heldRows.map((row) => {
                  const p = profileMap.get(row.user_id);
                  const mission = row.mission_id ? missionMap.get(row.mission_id) : null;
                  const client = mission?.client_id ? profileMap.get(mission.client_id) : null;
                  return (
                    <tr key={row.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="text-white/90">{p?.full_name ?? "—"}</p>
                        <p className="text-zinc-500">{p?.email ?? row.user_id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-300">{mission?.title ?? "—"}</p>
                        {client && (
                          <p className="text-zinc-600">client: {client.full_name ?? client.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#D1FF00]">
                        ${Number(row.amount_usd).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(row.held_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PayoutButton escrowId={row.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Transaction log
        </h2>
        {txRows.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No transactions yet"
            description="Bazaar purchases, escrow holds, and bounty releases will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-[4px] border-[0.5px] border-white/[0.08]">
            <table className="w-full min-w-[640px] font-mono text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-left">Seller</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">At</th>
                </tr>
              </thead>
              <tbody>
                {txRows.map((tx) => {
                  const buyer = tx.buyer_id ? profileMap.get(tx.buyer_id) : null;
                  const seller = tx.seller_id ? profileMap.get(tx.seller_id) : null;
                  const isRelease =
                    tx.tx_type === "bounty_release" || tx.tx_type === "kinetic_bounty_paid";
                  const isHold = tx.tx_type === "escrow_hold";
                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-white/[0.05] ${
                        isHold ? "bg-[#FF3131]/[0.03]" : isRelease ? "bg-[#D1FF00]/[0.03]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 uppercase text-zinc-400">
                        {TX_LABELS[tx.tx_type ?? ""] ?? tx.tx_type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {buyer?.full_name ?? buyer?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {seller?.full_name ?? seller?.email ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${
                          isRelease ? "text-[#D1FF00]" : isHold ? "text-[#FF3131]" : "text-zinc-300"
                        }`}
                      >
                        ${Number(tx.amount_usd).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
