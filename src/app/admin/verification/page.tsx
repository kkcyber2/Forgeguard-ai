import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { GrantAccessButton } from "./grant-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification Queue" };

export default async function VerificationQueuePage() {
  const admin = await requireAdminProfile();
  if (!admin) redirect("/dashboard");

  const db = createAdminSupabase();
  const { data: queue } = await db
    .from("profiles")
    .select(
      "id, email, full_name, phone, identity_audit_score, identity_audit_status, identity_audit_notes, sovereign_pending, clearance_tier, identity_document_path, identity_verified, created_at",
    )
    .or(
      "clearance_tier.eq.pending,sovereign_pending.eq.true,identity_audit_status.eq.review,identity_audit_status.eq.pending",
    )
    .order("identity_audit_score", { ascending: false, nullsFirst: false })
    .limit(100);

  const pending = queue ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Admin · Clearance"
        title="Verification queue"
        description="Operators awaiting Sovereign clearance. Review AI audit scores before granting access."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Queue empty"
          description="No operators are pending Sovereign review."
        />
      ) : (
        <div className="overflow-hidden rounded-[4px] border-[0.5px] border-white/[0.08]">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b-[0.5px] border-white/[0.08] bg-white/[0.02] text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">AI score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr
                  key={row.id}
                  className="border-b-[0.5px] border-white/[0.05] hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <p className="text-white/90">{row.full_name ?? "—"}</p>
                    <p className="text-zinc-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#D1FF00]">
                    {row.identity_audit_score != null
                      ? `${Number(row.identity_audit_score).toFixed(1)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 uppercase">
                    {row.identity_audit_status}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-zinc-500">
                    {row.identity_audit_notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <GrantAccessButton userId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
