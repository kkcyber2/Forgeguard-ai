import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { fetchTotalAleRisk, fetchRecentScans } from "@/lib/scans/queries";
import type { RedTeamLog } from "@/components/dashboard/red-team-feed";

type ServerSupabase = SupabaseClient<Database>;

export interface DashboardOverviewData {
  userType: "client" | "hacker" | "developer" | null;
  accessLevel: number;
  domainVerified: boolean;
  domainToken: string | null;
  reputation: number;
  activeMissionCount: number;
  recentBazaarSales: number;
  aegisRuleCount: number;
  activeBountySpend: number;
  totalAleRisk: number;
  scanRows: Awaited<ReturnType<typeof fetchRecentScans>>;
  rawLogs: Array<{
    id: number;
    scan_id: string;
    type: string;
    severity: string;
    attack_name: string | null;
    payload: unknown;
    created_at: string;
  }>;
}

const EMPTY: DashboardOverviewData = {
  userType: null,
  accessLevel: 1,
  domainVerified: false,
  domainToken: null,
  reputation: 0,
  activeMissionCount: 0,
  recentBazaarSales: 0,
  aegisRuleCount: 0,
  activeBountySpend: 0,
  totalAleRisk: 0,
  scanRows: [],
  rawLogs: [],
};

export async function fetchDashboardOverview(
  supabase: ServerSupabase,
  userId: string,
): Promise<DashboardOverviewData> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let identityRow: {
      user_type: string | null;
      access_level: number | null;
      domain_verified: boolean | null;
      domain_token: string | null;
      reputation: number | null;
    } | null = null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_type, access_level, domain_verified, domain_token, active_view_mode, reputation",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) console.error("[dashboard] identity:", error.message);
      identityRow = data;
    } catch (err) {
      console.error("[dashboard] identity fetch:", err);
    }

    let scanIds: string[] = [];
    try {
      const { data: userScanIds, error } = await supabase
        .from("scans")
        .select("id")
        .eq("user_id", userId);
      if (error) console.error("[dashboard] scan ids:", error.message);
      scanIds = (userScanIds ?? []).map((s) => s.id);
    } catch (err) {
      console.error("[dashboard] scan ids:", err);
    }

    let activeMissionCount = 0;
    let recentBazaarSales = 0;
    let aegisRuleCount = 0;
    let escrowRows: { amount_usd: number | null }[] = [];

    try {
      const [missions, bazaar, aegis, escrow] = await Promise.all([
        supabase
          .from("missions")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress"),
        supabase
          .from("bazaar_purchases")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .gte("created_at", sevenDaysAgo),
        scanIds.length > 0
          ? supabase
              .from("aegis_rules")
              .select("id", { count: "exact", head: true })
              .in("scan_id", scanIds)
          : Promise.resolve({ count: 0, data: null, error: null }),
        supabase
          .from("bounty_escrow")
          .select("amount_usd, status")
          .eq("user_id", userId)
          .eq("status", "held"),
      ]);

      if (missions.error) console.error("[dashboard] missions:", missions.error.message);
      if (bazaar.error) console.error("[dashboard] bazaar:", bazaar.error.message);
      if ("error" in aegis && aegis.error) {
        console.error("[dashboard] aegis_rules:", aegis.error.message);
      }
      if (escrow.error) console.error("[dashboard] escrow:", escrow.error.message);

      activeMissionCount = missions.count ?? 0;
      recentBazaarSales = bazaar.count ?? 0;
      aegisRuleCount = ("count" in aegis ? aegis.count : 0) ?? 0;
      escrowRows = escrow.data ?? [];
    } catch (err) {
      console.error("[dashboard] kpi batch:", err);
    }

    const activeBountySpend = escrowRows.reduce(
      (sum, row) => sum + Number(row.amount_usd ?? 0),
      0,
    );

    const totalAleRisk = await fetchTotalAleRisk(supabase, userId);
    const scanRows = await fetchRecentScans(supabase, userId, 8);

    let rawLogs: DashboardOverviewData["rawLogs"] = [];
    try {
      const { data, error } = await supabase
        .from("scan_logs")
        .select("id, scan_id, type, severity, attack_name, payload, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) console.error("[dashboard] scan_logs:", error.message);
      rawLogs = (data ?? []) as DashboardOverviewData["rawLogs"];
    } catch (err) {
      console.error("[dashboard] scan_logs:", err);
    }

    return {
      userType: (identityRow?.user_type as DashboardOverviewData["userType"]) ?? null,
      accessLevel: identityRow?.access_level ?? 1,
      domainVerified: Boolean(identityRow?.domain_verified),
      domainToken: identityRow?.domain_token ?? null,
      reputation: identityRow?.reputation ?? 0,
      activeMissionCount,
      recentBazaarSales,
      aegisRuleCount,
      activeBountySpend,
      totalAleRisk,
      scanRows,
      rawLogs,
    };
  } catch (err) {
    console.error("[dashboard] fetchDashboardOverview fatal:", err);
    return EMPTY;
  }
}

export function mapLogsToRedTeam(rawLogs: DashboardOverviewData["rawLogs"]): RedTeamLog[] {
  return rawLogs
    .map((row) => toRedTeamLog(row))
    .filter((l): l is RedTeamLog => l !== null);
}

function toRedTeamLog(row: {
  id: number;
  scan_id: string;
  type: string;
  severity: string;
  attack_name: string | null;
  payload: unknown;
  created_at: string;
}): RedTeamLog | null {
  if (row.type !== "finding" && row.type !== "attempt" && row.type !== "audit") {
    return null;
  }

  const outcome: RedTeamLog["outcome"] =
    row.type === "finding" && (row.severity === "high" || row.severity === "critical")
      ? "leaked"
      : row.type === "audit"
        ? "audit"
        : "blocked";

  return {
    id: String(row.id),
    at: row.created_at,
    technique: row.attack_name ?? row.type,
    payload: summarisePayload(row.payload),
    outcome,
    severity: row.severity as RedTeamLog["severity"],
    scanId: row.scan_id,
  };
}

function summarisePayload(p: unknown): string {
  if (p == null) return "—";
  if (typeof p === "string") return p;
  if (typeof p !== "object") return String(p);
  const r = p as Record<string, unknown>;
  if (typeof r.message === "string") return r.message;
  if (typeof r.summary === "string") return r.summary;
  if (typeof r.attack === "string") return r.attack;
  if (typeof r.probe === "string") return r.probe;
  try {
    return JSON.stringify(r).slice(0, 160);
  } catch {
    return "[unserializable]";
  }
}
