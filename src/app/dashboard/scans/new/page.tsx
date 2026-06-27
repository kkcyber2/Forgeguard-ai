import * as React from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { getPlanMeta, type PlanId } from "@/lib/plans";
import { NewScanForm } from "./form";
import { suggestNextProbeFromCorpus } from "@/lib/training/corpus-suggest";

/**
 * /dashboard/scans/new — launch page.
 * -----------------------------------
 * Server wrapper: enforces auth and hands the form (a Client Component)
 * the static copy. The actual Server Action lives in ../actions.ts and
 * is bound inside the client form via useActionState.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewScanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/scans/new");

  const isSovereign = isSovereignOperator(user.email);

  const supabase = await createServerSupabase();
  const { data: quotaRow } = await supabase
    .from("my_scan_quota")
    .select("plan, scans_used_this_period, scans_allowed")
    .maybeSingle();

  const plan = (quotaRow?.plan as PlanId | undefined) ?? "free";
  const quota = isSovereign
    ? null
    : {
        plan,
        scansUsed: quotaRow?.scans_used_this_period ?? 0,
        scansAllowed:
          quotaRow?.scans_allowed ?? getPlanMeta(plan).scansPerMonth,
      };

  const probeSuggestion = await suggestNextProbeFromCorpus();

  return (
    <>
      <PageHeader
        eyebrow="Launch probe"
        title="New red-team scan"
        description="Paste the endpoint you want hardened and the API key ForgeGuard should use while probing. Credentials are sealed with AES-256-GCM before they touch the database."
      />
      <div className="mx-auto max-w-2xl">
        <NewScanForm
          isSovereign={isSovereign}
          quota={quota}
          probeSuggestion={probeSuggestion}
          userId={user.id}
        />
      </div>
    </>
  );
}
