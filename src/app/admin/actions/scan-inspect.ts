"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/supabase/server";

export interface ScanInspectResult {
  error?: string;
  scan?: Record<string, unknown>;
  logs?: Record<string, unknown>[];
  report?: Record<string, unknown> | null;
  operator?: {
    email: string;
    full_name: string | null;
    company_name: string | null;
    company_domain: string | null;
  };
  activityLogs?: Record<string, unknown>[];
  attackLogs?: Record<string, unknown>[];
  pointers?: {
    scan_id: string;
    user_id: string;
    target_url: string | null;
    status: string | null;
    finding_count: number | null;
    high_severity_count: number | null;
    report_id: string | null;
  };
}

export async function inspectScan(scanId: string): Promise<ScanInspectResult> {
  const admin = await requireAdminProfile();
  if (!admin) return { error: "Unauthorized." };

  if (!scanId?.trim()) return { error: "Scan id required." };

  const db = createAdminSupabase();

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .maybeSingle();

  if (scanErr || !scan) {
    return { error: scanErr?.message ?? "Scan not found." };
  }

  const userId = scan.user_id as string;

  const [
    { data: logs },
    { data: report },
    { data: profile },
    { data: activityLogs },
    { data: attackLogs },
  ] = await Promise.all([
    db
      .from("scan_logs")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("scan_reports").select("*").eq("scan_id", scanId).maybeSingle(),
    db
      .from("profiles")
      .select("email, full_name, company_name, company_domain, id")
      .eq("id", userId)
      .maybeSingle(),
    db
      .from("activity_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("attack_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const reportRow = report as Record<string, unknown> | null;

  return {
    scan: scan as Record<string, unknown>,
    logs: (logs ?? []) as Record<string, unknown>[],
    report: reportRow,
    operator: profile
      ? {
          email: profile.email,
          full_name: profile.full_name,
          company_name: profile.company_name,
          company_domain: profile.company_domain,
        }
      : undefined,
    activityLogs: (activityLogs ?? []) as Record<string, unknown>[],
    attackLogs: (attackLogs ?? []) as Record<string, unknown>[],
    pointers: {
      scan_id: scanId,
      user_id: userId,
      target_url: (scan.target_url as string | null) ?? null,
      status: (scan.status as string | null) ?? null,
      finding_count: (scan.finding_count as number | null) ?? null,
      high_severity_count: (scan.high_severity_count as number | null) ?? null,
      report_id: reportRow?.id != null ? String(reportRow.id) : null,
    },
  };
}
