import { PageHeader } from "@/components/dashboard/shell";
import { CommandCenter } from "@/components/admin/command-center";
import type { AdminOperatorRow } from "@/components/admin/user-directory";
import type { AdminScanRow } from "@/components/admin/scan-inspector-drawer";
import { resolveScanTargets, type PopNodeId } from "@/lib/admin/resolve-scan-node";
import type { ScanTargetPulse } from "@/components/dashboard/live-world-map";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabase();

  const [
    { data: profiles, error: profilesErr },
    { data: scans, error: scansErr },
    { data: wallets },
    { data: activityLogs },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, company_name, role, is_verified, created_at, hacker_rank, access_level",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("scans")
      .select(
        "id, user_id, target_model, target_url, status, finding_count, high_severity_count, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("user_wallets").select("user_id, balance_usd"),
    supabase
      .from("activity_logs")
      .select("user_id, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  if (profilesErr) console.error("[admin] profiles:", profilesErr.message);
  if (scansErr) console.error("[admin] scans:", scansErr.message);

  const walletMap = new Map(
    (wallets ?? []).map((w) => [w.user_id, Number(w.balance_usd ?? 0)]),
  );

  const ipByUser = new Map<string, string>();
  for (const log of activityLogs ?? []) {
    if (log.user_id && log.ip_address && !ipByUser.has(log.user_id)) {
      ipByUser.set(log.user_id, log.ip_address);
    }
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p as ProfileRow & { account_status?: string }]),
  );

  const operators: AdminOperatorRow[] = (profiles ?? []).map((p) => {
    const row = p as ProfileRow & { account_status?: string };
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      company: row.company_name,
      role: row.role,
      hackerRank: row.hacker_rank,
      accessLevel: row.access_level,
      accountStatus: row.account_status ?? "active",
      walletBalance: walletMap.get(row.id) ?? 0,
      lastIp: ipByUser.get(row.id) ?? null,
      isVerified: row.is_verified ?? false,
    };
  });

  const scanRows: AdminScanRow[] = (scans ?? []).map((s) => {
    const op = profileById.get(s.user_id);
    return {
      id: s.id,
      user_id: s.user_id,
      target_url: s.target_url,
      target_model: s.target_model,
      status: s.status,
      finding_count: s.finding_count,
      created_at: s.created_at,
      operatorEmail: op?.email,
      companyName: op?.company_name,
    };
  });

  const activeScans = (scans ?? []).filter(
    (s) => s.status === "queued" || s.status === "probing",
  ).length;

  const scanTargets: ScanTargetPulse[] = (scans ?? [])
    .filter((s) => s.status === "queued" || s.status === "probing")
    .map((s) => ({
      id: s.id,
      target_url: s.target_url,
      target_model: s.target_model,
    }));

  const pulseNodeIds: PopNodeId[] = resolveScanTargets(scanTargets);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Unified command center"
        description="Live threat surface, operator directory, and sovereign power tools."
      />
      <CommandCenter
        activeScans={activeScans}
        scanTargets={scanTargets}
        pulseNodeIds={pulseNodeIds}
        operators={operators}
        scans={scanRows}
      />
    </>
  );
}
