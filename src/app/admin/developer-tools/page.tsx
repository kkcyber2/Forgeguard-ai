import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditQueue, type AuditToolRow } from "./audit-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "Developer Tools · Admin" };

export default async function DeveloperToolsAdminPage() {
  const supabase = await createServerSupabase();

  const { data: tools } = await supabase
    .from("custom_attack_tools")
    .select("id, name, family, intensity_min, status, network_allowed, audit_result, code, created_at, author_id")
    .order("created_at", { ascending: false });

  const rows = (tools ?? []) as Array<{
    id: string;
    name: string;
    family: string;
    intensity_min: string;
    status: string;
    network_allowed: boolean;
    audit_result: string | null;
    code: string;
    created_at: string;
    author_id: string;
  }>;

  // Resolve author display info in one batched query.
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", authorIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };

  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  const queue: AuditToolRow[] = rows.map((r) => {
    const a = authorMap.get(r.author_id);
    return {
      id: r.id,
      name: r.name,
      family: r.family,
      intensity_min: r.intensity_min,
      status: r.status,
      network_allowed: r.network_allowed,
      audit_result: r.audit_result,
      code: r.code,
      created_at: r.created_at,
      author_email: a?.email ?? null,
      author_name: a?.full_name ?? null,
    };
  });

  // Sort: pending first, then rejected, then newest.
  const rank = (s: string) => (s === "pending" ? 0 : s === "rejected" ? 1 : s === "disabled" ? 2 : 3);
  queue.sort((a, b) => rank(a.status) - rank(b.status) || b.created_at.localeCompare(a.created_at));

  const pending = queue.filter((t) => t.status === "pending").length;
  const approved = queue.filter((t) => t.status === "approved").length;
  const rejected = queue.filter((t) => t.status === "rejected").length;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Developer Tools"
        title="Custom attack tool audit"
        description="Sovereign review queue for operator-authored attack plugins. Every submission is pre-screened by a static analyzer, then must be approved here before the Agathon Brain can run it via run_operator_tool."
        actions={
          <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={13} strokeWidth={1.5} />
            Overview
          </Link>
        }
      />

      <Stagger className="mb-6 grid gap-3 sm:grid-cols-3">
        <StaggerItem>
          <StatTile
            label="Awaiting review"
            value={pending}
            tone={pending ? "admin" : "neutral"}
            footer={<span className="font-mono text-[10px] uppercase tracking-[0.14em]">pending audit</span>}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Approved"
            value={approved}
            tone={approved ? "secure" : "neutral"}
            footer={<span className="font-mono text-[10px] uppercase tracking-[0.14em]">Brain-runnable</span>}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Rejected"
            value={rejected}
            tone={rejected ? "threat" : "neutral"}
            footer={<span className="font-mono text-[10px] uppercase tracking-[0.14em]">sandbox-escape risk</span>}
          />
        </StaggerItem>
      </Stagger>

      <AuditQueue tools={queue} />
    </>
  );
}
