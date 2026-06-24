import { CommandCenter } from "@/components/admin/command-center";
import type { AdminOperatorRow } from "@/components/admin/user-directory";
import type { AdminScanRow } from "@/components/admin/scan-inspector-drawer";
import type { PendingBazaarScript } from "@/components/admin/bazaar-triage-panel";
import type { BountyEscrowRow } from "@/components/admin/mission-control-panel";
import type { VerificationQueueRow } from "@/app/admin/verification/verification-row";
import type { ScanTargetPulse } from "@/components/dashboard/tactical-world-map";
import { fetchLiveMapBootstrap } from "@/lib/live-map/platform-events";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

async function fetchPendingScripts(): Promise<PendingBazaarScript[]> {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db
      .from("bazaar_scripts")
      .select(
        "id, name, description, language, price_usd, audit_risk_score, audit_verdict, created_at",
      )
      .in("audit_verdict", ["pending", "pending_audit", "flagged"])
      .eq("is_published", false)
      .eq("is_removed", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[admin] bazaar triage:", error.message);
      return [];
    }
    return (data ?? []) as PendingBazaarScript[];
  } catch (err) {
    console.error("[admin] bazaar triage:", err);
    return [];
  }
}

async function fetchVerificationQueue(): Promise<VerificationQueueRow[]> {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db
      .from("profiles")
      .select(
        "id, email, full_name, identity_audit_score, identity_audit_status, identity_audit_notes, identity_document_path",
      )
      .or(
        "clearance_tier.eq.pending,sovereign_pending.eq.true,identity_audit_status.eq.review,identity_audit_status.eq.pending",
      )
      .order("identity_audit_score", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      console.error("[admin] verification queue:", error.message);
      return [];
    }
    return (data ?? []) as VerificationQueueRow[];
  } catch (err) {
    console.error("[admin] verification queue:", err);
    return [];
  }
}

async function fetchBountyEscrows(): Promise<BountyEscrowRow[]> {
  try {
    const db = createAdminSupabase();
    const { data: escrows, error } = await db
      .from("bounty_escrow")
      .select("id, user_id, amount_usd, held_at, mission_id")
      .eq("status", "held")
      .order("held_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[admin] bounty escrow:", error.message);
      return [];
    }
    const rows = escrows ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const missionIds = [
      ...new Set(rows.map((r) => r.mission_id).filter(Boolean) as string[]),
    ];

    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] };
    const { data: missions } = missionIds.length
      ? await db.from("missions").select("id, title").in("id", missionIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const missionMap = new Map((missions ?? []).map((m) => [m.id, m]));

    return rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      const mission = row.mission_id ? missionMap.get(row.mission_id) : null;
      return {
        id: row.id,
        user_id: row.user_id,
        amount_usd: Number(row.amount_usd ?? 0),
        held_at: row.held_at,
        missionTitle: mission?.title ?? null,
        operatorEmail: profile?.email ?? null,
        operatorName: profile?.full_name ?? null,
      };
    });
  } catch (err) {
    console.error("[admin] bounty escrow:", err);
    return [];
  }
}

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabase();

  const [
    { data: profiles, error: profilesErr },
    { data: scans, error: scansErr },
    { data: wallets },
    { data: activityLogs },
    pendingScripts,
    verificationQueue,
    bountyEscrows,
    liveMapBootstrap,
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
    fetchPendingScripts(),
    fetchVerificationQueue(),
    fetchBountyEscrows(),
    fetchLiveMapBootstrap(20),
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
    }));

  return (
    <CommandCenter
      activeScans={activeScans}
      pendingTriage={pendingScripts.length}
      applicantCount={verificationQueue.length}
      scanTargets={scanTargets}
      liveMapBootstrap={liveMapBootstrap}
      operators={operators}
      scans={scanRows}
      pendingScripts={pendingScripts}
      verificationQueue={verificationQueue}
      bountyEscrows={bountyEscrows}
    />
  );
}
