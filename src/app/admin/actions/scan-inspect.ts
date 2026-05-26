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

  const [{ data: logs }, { data: report }, { data: profile }] = await Promise.all([
    db
      .from("scan_logs")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("scan_reports").select("*").eq("scan_id", scanId).maybeSingle(),
    db
      .from("profiles")
      .select("email, full_name, company_name, company_domain")
      .eq("id", scan.user_id)
      .maybeSingle(),
  ]);

  return {
    scan: scan as Record<string, unknown>,
    logs: (logs ?? []) as Record<string, unknown>[],
    report: (report as Record<string, unknown> | null) ?? null,
    operator: profile
      ? {
          email: profile.email,
          full_name: profile.full_name,
          company_name: profile.company_name,
          company_domain: profile.company_domain,
        }
      : undefined,
  };
}
