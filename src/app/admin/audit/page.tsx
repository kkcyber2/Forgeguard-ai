import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldAlert, FileDown } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/server";
import { resolveAccessRank } from "@/lib/access/ranks";
import { verifyAuditChain } from "@/lib/compliance/audit-chain";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "Audit Chains" };

type ScanRow = {
  id: string;
  user_id: string;
  target_model: string | null;
  target_url: string | null;
  intensity: string | null;
  status: string | null;
  scope_host: string | null;
  finding_count: number | null;
  created_at: string | null;
};

export default async function AdminAuditPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/audit");

  const profile = await getCurrentProfile();
  const rank = resolveAccessRank(profile?.access_level ?? 1, profile?.role ?? null);
  if (rank < 5) redirect("/dashboard");

  const admin = createAdminSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (admin as any)
    .from("scans")
    .select(
      "id, user_id, target_model, target_url, intensity, status, scope_host, finding_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50)) as { data: ScanRow[] | null; error: { message: string } | null };

  if (error) console.error("[admin/audit]", error.message);
  const scans = data ?? [];

  // Verify each chain (best-effort — a scan with no events is "no chain").
  const rows = await Promise.all(
    scans.map(async (s) => {
      let valid = false;
      let length = 0;
      try {
        const v = await verifyAuditChain(admin, s.id);
        valid = v.valid;
        length = v.length;
      } catch {
        /* treat as invalid */
      }
      return { ...s, chain_valid: valid, chain_length: length };
    }),
  );

  const verifiedCount = rows.filter((r) => r.chain_length > 0 && r.chain_valid).length;
  const brokenCount = rows.filter((r) => r.chain_length > 0 && !r.chain_valid).length;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Trust"
        title="Audit chains"
        description="Tamper-evident hash-chained audit trail per scan. Verify chain integrity and download the signed compliance evidence pack."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm border border-white/[0.06] bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
            Scans shown
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{rows.length}</p>
        </div>
        <div className="rounded-sm border border-white/[0.06] bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
            Chains valid
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-foreground">
            {verifiedCount}
            <ShieldCheck size={16} className="text-emerald-400" />
          </p>
        </div>
        <div className="rounded-sm border border-white/[0.06] bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle">
            Chains broken
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-foreground">
            {brokenCount}
            {brokenCount > 0 && <ShieldAlert size={16} className="text-red-400" />}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-sm border border-white/[0.06] bg-surface">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <p className="text-sm font-medium text-foreground">Recent scans</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No scans yet"
            description="Scans with audit chains will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-left">
                  {["Scan", "Scope", "Intensity", "Status", "Chain", "Created", "Export"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-subtle"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.015]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/scans/${r.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {r.target_model ?? "—"}
                      </Link>
                      <p className="font-mono text-[10px] text-foreground-subtle">
                        {r.target_url ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground-muted">
                      {r.scope_host ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{r.intensity ?? "standard"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">{r.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.chain_length === 0 ? (
                        <Badge tone="warn">No chain</Badge>
                      ) : r.chain_valid ? (
                        <Badge tone="secure">
                          Valid · {r.chain_length}
                        </Badge>
                      ) : (
                        <Badge tone="threat">Broken</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground-muted">
                      {r.created_at ? formatRelativeTime(r.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/api/scans/${r.id}/audit-export`}
                        className={buttonStyles({ variant: "secondary", size: "sm" })}
                      >
                        <FileDown size={13} strokeWidth={1.5} />
                        JSON
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-foreground-subtle">
        Audit events are append-only (UPDATE/DELETE revoked). A broken chain indicates tampering.
      </p>
    </>
  );
}
