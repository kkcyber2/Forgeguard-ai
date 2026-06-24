import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shell";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import {
  fetchDashboardAnalytics,
  fetchThreatsBlockedAnalytics,
} from "@/lib/analytics/dashboard-metrics";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/server";
import { resolveAccessRank } from "@/lib/access/ranks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Platform Analytics" };

export default async function AdminAnalyticsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/admin/analytics");

  const profile = await getCurrentProfile();
  const rank = resolveAccessRank(profile?.access_level ?? 1, profile?.role ?? null);
  if (rank < 5) redirect("/dashboard");

  const admin = createAdminSupabase();
  const data = await fetchDashboardAnalytics(admin);

  try {
    const threats = await fetchThreatsBlockedAnalytics(admin);
    data.threatsBlockedTotal = threats.threatsBlockedTotal;
    data.threatsBlockedTrend = threats.threatsBlockedTrend;
  } catch {
    /* attack_logs may be unavailable */
  }

  return (
    <>
      <PageHeader
        eyebrow="Legend · Platform"
        title="Platform analytics"
        description="Live aggregates from scans, findings, operators, and ledger activity — last 30 days."
      />
      <AnalyticsCharts data={data} />
    </>
  );
}
