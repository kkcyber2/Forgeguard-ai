import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Radar } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { ScanCard, type ScanCardData } from "@/components/dashboard/scan-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Stagger, StaggerItem } from "@/components/dashboard/stagger";
import { buttonStyles } from "@/components/ui/button";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { scansTableToCards } from "@/lib/scans/adapt";

/**
 * /dashboard/scans — list all scans owned by the current user.
 * RLS ensures we only ever see our own rows.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScansListPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/scans");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("scans")
    .select(
      "id, target_model, target_url, status, progress_pct, finding_count, high_severity_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) console.error("[scans] list:", error.message);

  const cards: ScanCardData[] = scansTableToCards(data ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Surface"
        title="Scans"
        description="Every red-team run you've launched. Click any row for the live log."
        actions={
          <Link
            href="/dashboard/scans/new"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            <Plus size={14} strokeWidth={1.75} />
            New scan
          </Link>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No scans found"
          description="Start your first audit. Paste a target endpoint + API key and ForgeGuard begins probing immediately."
          action={
            <Link
              href="/dashboard/scans/new"
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              <Plus size={14} strokeWidth={1.75} />
              Start your first audit
            </Link>
          }
        />
      ) : (
        <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((s) => (
            <StaggerItem key={s.id}>
              <ScanCard scan={s} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
