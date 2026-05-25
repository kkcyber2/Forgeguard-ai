import { PageHeader } from "@/components/dashboard/shell";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import {
  fetchDashboardAnalytics,
  fetchThreatsBlockedAnalytics,
} from "@/lib/analytics/dashboard-metrics";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createServerSupabase();
  const data = await fetchDashboardAnalytics(supabase);

  try {
    const admin = createAdminSupabase();
    const threats = await fetchThreatsBlockedAnalytics(admin);
    data.threatsBlockedTotal = threats.threatsBlockedTotal;
    data.threatsBlockedTrend = threats.threatsBlockedTrend;
  } catch {
    /* attack_logs may be unavailable — keep zeroed defaults */
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations · Intelligence"
        title="Platform analytics"
        description="Live aggregates from scans, findings, operators, and ledger activity — last 30 days."
      />
      <AnalyticsCharts data={data} />
    </>
  );
}
