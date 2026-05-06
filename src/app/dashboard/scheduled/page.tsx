import * as React from "react";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { ScheduledScanManager } from "./manager";

/**
 * /dashboard/scheduled
 * ──────────────────────────────────────────────────────────────────────────
 * Manage recurring scan schedules. Server-rendered shell hands off to a
 * client component for optimistic create / toggle / delete interactions.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface ScheduledScanRow {
  id: string;
  name: string;
  target_model: string;
  target_url: string;
  frequency: "daily" | "weekly" | "monthly";
  active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

export default async function ScheduledPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/scheduled");

  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("scheduled_scans")
    .select(
      "id, name, target_model, target_url, frequency, active, last_run_at, next_run_at, created_at",
    )
    .order("created_at", { ascending: false });

  const schedules: ScheduledScanRow[] = (data ?? []) as ScheduledScanRow[];

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Scheduled Scans"
        description="Run red-team probes on a recurring cadence — daily, weekly, or monthly."
      />

      <ScheduledScanManager initialSchedules={schedules} />
    </>
  );
}
