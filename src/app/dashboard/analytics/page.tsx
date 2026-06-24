import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { fetchUserDashboardAnalytics } from "@/lib/analytics/dashboard-metrics";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/dashboard/analytics");

  const supabase = await createServerSupabase();
  const data = await fetchUserDashboardAnalytics(supabase, user.id);

  return (
    <>
      <PageHeader
        eyebrow="Operations · Your estate"
        title="Scan analytics"
        description="Your scans, findings, and ledger activity — last 30 days."
      />
      <AnalyticsCharts data={data} />
    </>
  );
}
