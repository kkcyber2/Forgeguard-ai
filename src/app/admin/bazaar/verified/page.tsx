import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  Code2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { requireAdminProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buttonStyles } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verified Catalog" };

interface VerifiedScript {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  price_usd: number | null;
  purchase_count: number | null;
  audit_risk_score: number | null;
  created_at: string;
  author_id: string;
  is_certified: boolean | null;
}

export default async function AdminBazaarVerifiedPage() {
  const profile = await requireAdminProfile();
  if (!profile) redirect("/dashboard");

  const db = createAdminSupabase();
  const { data, error } = await db
    .from("bazaar_scripts")
    .select(
      "id, name, description, language, price_usd, purchase_count, audit_risk_score, created_at, author_id, is_certified",
    )
    .eq("is_certified", true)
    .eq("audit_verdict", "cleared")
    .eq("is_published", true)
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) console.error("[admin/bazaar/verified]", error.message);
  const scripts = (data ?? []) as VerifiedScript[];

  const totalPurchases = scripts.reduce((a, s) => a + (s.purchase_count ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Command · Bazaar"
        title="Verified catalog"
        description="All sovereign-certified scripts cleared for public distribution."
        actions={
          <Link href="/admin/bazaar" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} />
            Triage queue
          </Link>
        }
      />

      <Stagger className="mb-6 grid gap-3 sm:grid-cols-3">
        <StaggerItem>
          <StatTile label="Certified scripts" value={scripts.length} tone="secure" icon={ShieldCheck} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Total installs" value={totalPurchases} tone="neutral" icon={Users} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Avg risk score"
            value={
              scripts.length
                ? (
                    scripts.reduce((a, s) => a + (s.audit_risk_score ?? 0), 0) /
                    scripts.length
                  ).toFixed(1)
                : "—"
            }
            tone="neutral"
            icon={Code2}
          />
        </StaggerItem>
      </Stagger>

      {scripts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No verified scripts"
          description="Scripts appear here after certification and publish."
        />
      ) : (
        <div
          className="overflow-x-auto rounded-sm border-[0.5px] border-white/[0.08]"
          style={{ background: "#050505" }}
        >
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                {["Script", "Language", "Price", "Installs", "Risk", "Certified"].map((h) => (
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
              {scripts.map((s) => (
                <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bazaar/${s.id}`}
                      className="font-mono text-foreground hover:text-acid"
                    >
                      {s.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-foreground-muted">
                      {s.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground-muted">{s.language ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">
                    {s.price_usd != null && s.price_usd > 0
                      ? `$${Number(s.price_usd).toFixed(2)}`
                      : "Free"}
                  </td>
                  <td className="px-4 py-3 font-mono">{s.purchase_count ?? 0}</td>
                  <td className="px-4 py-3 font-mono">{s.audit_risk_score ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-foreground-subtle">
                    {formatRelativeTime(s.created_at)}
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
