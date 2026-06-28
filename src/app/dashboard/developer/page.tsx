import * as React from "react";
import { PageHeader } from "@/components/dashboard/shell";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { createServerSupabase, getCurrentProfile, getSessionUser } from "@/lib/supabase/server";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { redirect } from "next/navigation";
import { DeveloperToolForm } from "./developer-tool-form";
import { DeveloperToolList, type DeveloperToolRow } from "./developer-tool-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata = { title: "Developer Console · ForgeGuard" };

export default async function DeveloperConsolePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");

  const accessLevel = (profile.access_level as number | undefined) ?? 1;
  const user = await getSessionUser();
  const sovereign = isSovereignOperator(user?.email ?? profile.email ?? "");
  if (!sovereign && accessLevel < 3) {
    return (
      <>
        <PageHeader
          eyebrow="Developer · Console"
          title="Developer console"
          description="Author custom attack plugins that the Agathon Brain can run inside its sandboxed closed-loop."
        />
        <p className="text-sm text-foreground-subtle">
          Rank 3+ required to author custom attack tools.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const { data: tools } = await supabase
    .from("custom_attack_tools")
    .select(
      "id, name, family, intensity_min, status, network_allowed, audit_result, created_at, updated_at",
    )
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false });

  const rows = (tools ?? []) as unknown as DeveloperToolRow[];

  const approved = rows.filter((t) => t.status === "approved").length;
  const pending = rows.filter((t) => t.status === "pending").length;
  const rejected = rows.filter((t) => t.status === "rejected").length;

  return (
    <>
      <PageHeader
        eyebrow="Developer · Console"
        title="Developer console"
        description="Author custom attack plugins that the Agathon Brain can run inside its sandboxed closed-loop. Every submission passes a static pre-screen, then a sovereign admin audit, before it becomes runnable."
      />

      <Stagger className="mb-6 grid gap-3 sm:grid-cols-3">
        <StaggerItem>
          <StatTile
            label="Approved (Brain-runnable)"
            value={approved}
            tone={approved ? "secure" : "neutral"}
            footer={<span className="font-mono text-[10px] uppercase tracking-[0.14em]">in run_operator_tool</span>}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="In audit queue"
            value={pending}
            tone={pending ? "admin" : "neutral"}
            footer={<span className="font-mono text-[10px] uppercase tracking-[0.14em]">awaiting sovereign review</span>}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <DeveloperToolForm />
        <div>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-eyebrow text-foreground-subtle">Your submissions</p>
            <Badge tone="neutral" className="ml-auto">
              {rows.length} total
            </Badge>
          </div>
          <DeveloperToolList tools={rows} />
        </div>
      </div>
    </>
  );
}
