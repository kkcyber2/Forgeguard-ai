import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { SeverityCounts } from "@/components/dashboard/severity-meter";

export interface DashboardAnalytics {
  totalScans: number;
  completedScans: number;
  failedScans: number;
  totalFindings: number;
  highSeverityScans: number;
  scanTrend: number[];
  severityCounts: SeverityCounts;
  operatorsTotal: number;
  operatorsWeek: number;
  operatorsMonth: number;
  operatorTrend: number[];
  txVolumeUsd: number;
  txCount: number;
  threatsBlockedTotal: number;
  threatsBlockedTrend: number[];
}

function bucketByDay(dates: string[], days = 30): number[] {
  const buckets = Array.from({ length: days }, () => 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const iso of dates) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    const idx = days - 1 - diff;
    if (idx >= 0 && idx < days) buckets[idx]! += 1;
  }
  return buckets;
}

function bucketByDayFromField(
  rows: { blocked_at: string }[],
  field: "blocked_at",
  days = 30,
): number[] {
  return bucketByDay(rows.map((r) => r[field]), days);
}

export async function fetchThreatsBlockedAnalytics(
  admin: SupabaseClient<Database>,
): Promise<{ threatsBlockedTotal: number; threatsBlockedTrend: number[] }> {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: attacks } = await admin
    .from("attack_logs")
    .select("blocked_at")
    .gte("blocked_at", since30)
    .order("blocked_at", { ascending: false })
    .limit(5000);

  const rows = attacks ?? [];
  return {
    threatsBlockedTotal: rows.length,
    threatsBlockedTrend: bucketByDayFromField(rows, "blocked_at"),
  };
}

/** User-scoped analytics for /dashboard/analytics */
export async function fetchUserDashboardAnalytics(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardAnalytics> {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: userScans } = await supabase
    .from("scans")
    .select("id")
    .eq("user_id", userId);
  const scanIds = (userScans ?? []).map((s) => s.id);

  const [
    { data: scans },
    { data: logs },
    { data: txs },
  ] = await Promise.all([
    scanIds.length > 0
      ? supabase
          .from("scans")
          .select("id, status, finding_count, high_severity_count, created_at")
          .eq("user_id", userId)
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] }),
    scanIds.length > 0
      ? supabase
          .from("scan_logs")
          .select("severity, created_at")
          .in("scan_id", scanIds)
          .gte("created_at", since30)
          .limit(5000)
      : Promise.resolve({ data: [] }),
    supabase
      .from("platform_transactions")
      .select("amount_usd, created_at")
      .or(
        `buyer_id.eq.${userId},sender_id.eq.${userId},receiver_id.eq.${userId},seller_id.eq.${userId}`,
      )
      .gte("created_at", since30)
      .limit(2000),
  ]);

  const scanRows = scans ?? [];
  const logRows = logs ?? [];
  const txRows = txs ?? [];

  const severityCounts: SeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const row of logRows) {
    const s = (row.severity ?? "info").toLowerCase();
    if (s in severityCounts) {
      severityCounts[s as keyof SeverityCounts]! += 1;
    } else {
      severityCounts.info! += 1;
    }
  }

  return {
    totalScans: scanRows.length,
    completedScans: scanRows.filter((s) => s.status === "completed").length,
    failedScans: scanRows.filter((s) => s.status === "failed").length,
    totalFindings: scanRows.reduce((a, s) => a + (s.finding_count ?? 0), 0),
    highSeverityScans: scanRows.filter((s) => (s.high_severity_count ?? 0) > 0).length,
    scanTrend: bucketByDay(scanRows.map((s) => s.created_at)),
    severityCounts,
    operatorsTotal: 1,
    operatorsWeek: 0,
    operatorsMonth: 0,
    operatorTrend: Array.from({ length: 30 }, () => 0),
    txVolumeUsd: txRows.reduce((a, t) => a + Number(t.amount_usd ?? 0), 0),
    txCount: txRows.length,
    threatsBlockedTotal: 0,
    threatsBlockedTrend: Array.from({ length: 30 }, () => 0),
  };
}

/** Platform-wide analytics for /admin/analytics (service-role or admin session). */
export async function fetchDashboardAnalytics(
  supabase: SupabaseClient<Database>,
): Promise<DashboardAnalytics> {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: scans },
    { data: logs },
    { data: profiles },
    { data: txs },
  ] = await Promise.all([
    supabase
      .from("scans")
      .select("id, status, finding_count, high_severity_count, created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("scan_logs")
      .select("severity, created_at")
      .gte("created_at", since30)
      .limit(5000),
    supabase
      .from("profiles")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("platform_transactions")
      .select("amount_usd, created_at")
      .gte("created_at", since30)
      .limit(2000),
  ]);

  const scanRows = scans ?? [];
  const logRows = logs ?? [];
  const profileRows = profiles ?? [];
  const txRows = txs ?? [];

  const severityCounts: SeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const row of logRows) {
    const s = (row.severity ?? "info").toLowerCase();
    if (s in severityCounts) {
      severityCounts[s as keyof SeverityCounts]! += 1;
    } else {
      severityCounts.info! += 1;
    }
  }

  return {
    totalScans: scanRows.length,
    completedScans: scanRows.filter((s) => s.status === "completed").length,
    failedScans: scanRows.filter((s) => s.status === "failed").length,
    totalFindings: scanRows.reduce((a, s) => a + (s.finding_count ?? 0), 0),
    highSeverityScans: scanRows.filter((s) => (s.high_severity_count ?? 0) > 0).length,
    scanTrend: bucketByDay(scanRows.map((s) => s.created_at)),
    severityCounts,
    operatorsTotal: profileRows.length,
    operatorsWeek: profileRows.filter(
      (p) => p.created_at && p.created_at >= since7,
    ).length,
    operatorsMonth: profileRows.filter(
      (p) => p.created_at && p.created_at >= since30,
    ).length,
    operatorTrend: bucketByDay(
      profileRows
        .map((p) => p.created_at)
        .filter((d): d is string => Boolean(d)),
    ),
    txVolumeUsd: txRows.reduce((a, t) => a + Number(t.amount_usd ?? 0), 0),
    txCount: txRows.length,
    threatsBlockedTotal: 0,
    threatsBlockedTrend: Array.from({ length: 30 }, () => 0),
  };
}