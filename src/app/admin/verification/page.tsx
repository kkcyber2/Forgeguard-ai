import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { VerificationRow } from "./verification-row";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
        description="DeepSeek-R1 identity triage. Run AI audit, review confidence scores, grant Sovereign clearance."
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
        <div className="overflow-x-auto rounded-[4px] border-[0.5px] border-white/[0.08]">
          <table className="w-full min-w-[720px] text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b-[0.5px] border-white/[0.08] bg-white/[0.02] text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">AI audit summary</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <VerificationRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
