"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import {
  executeOsintQuery,
  normaliseDomain,
} from "@/lib/intel/osint-runners";
import { VAULT_QUERY_TYPES, type VaultQueryType } from "@/lib/intel/vault-types";

export type VaultResultRow = {
  id: string;
  query_id: string;
  scan_id: string | null;
  query_type: string;
  target_domain: string;
  result: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

const HOURLY_LIMIT = 30;
const MINUTE_LIMIT = 6;

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  action: string,
  queryId: string | null,
  meta: Record<string, unknown> = {},
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("intel_vault_audit").insert({
    user_id: userId,
    query_id: queryId,
    action,
    meta,
  });
}

async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: hourCount } = await (supabase as any)
    .from("intel_vault_queries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo);

  if ((hourCount ?? 0) >= HOURLY_LIMIT) {
    return `Rate limit: max ${HOURLY_LIMIT} queries per hour.`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: minuteCount } = await (supabase as any)
    .from("intel_vault_queries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", minuteAgo);

  if ((minuteCount ?? 0) >= MINUTE_LIMIT) {
    return `Rate limit: max ${MINUTE_LIMIT} queries per minute.`;
  }

  return null;
}

async function verifyScanOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  scanId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function runIntelVaultQuery(input: {
  targetDomain: string;
  queryType: string;
  scanId?: string;
}): Promise<{ ok?: boolean; result?: VaultResultRow; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  if (!VAULT_QUERY_TYPES.includes(input.queryType as VaultQueryType)) {
    return { error: "Invalid query type." };
  }
  const queryType = input.queryType as VaultQueryType;

  let domain: string;
  try {
    domain = normaliseDomain(input.targetDomain);
  } catch {
    return { error: "Invalid domain." };
  }

  const supabase = await createServerSupabase();

  const rateErr = await checkRateLimit(supabase, user.id);
  if (rateErr) {
    await writeAudit(supabase, user.id, "rate_limited", null, {
      query_type: queryType,
      target_domain: domain,
    });
    return { error: rateErr };
  }

  let scanId: string | null = null;
  if (input.scanId?.trim()) {
    const owned = await verifyScanOwnership(supabase, user.id, input.scanId.trim());
    if (!owned) return { error: "Scan not found or not owned by you." };
    scanId = input.scanId.trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: queryRow, error: queryErr } = await (supabase as any)
    .from("intel_vault_queries")
    .insert({
      user_id: user.id,
      scan_id: scanId,
      query_type: queryType,
      target_domain: domain,
      status: "pending",
    })
    .select("id")
    .single();

  if (queryErr || !queryRow) {
    return { error: queryErr?.message ?? "Failed to create query." };
  }

  const queryId = queryRow.id as string;
  await writeAudit(supabase, user.id, "query_started", queryId, {
    query_type: queryType,
    target_domain: domain,
    scan_id: scanId,
  });

  let resultPayload: Record<string, unknown> = {};
  let errorMessage: string | null = null;
  let status: "completed" | "failed" = "completed";

  try {
    resultPayload = await executeOsintQuery(queryType, domain);
    if (resultPayload.error) {
      status = "failed";
      errorMessage = String(resultPayload.error);
    }
  } catch (e) {
    status = "failed";
    errorMessage = e instanceof Error ? e.message : "Query failed.";
    resultPayload = { domain, error: errorMessage };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("intel_vault_queries")
    .update({ status })
    .eq("id", queryId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: resultRow, error: resultErr } = await (supabase as any)
    .from("intel_vault_results")
    .insert({
      query_id: queryId,
      user_id: user.id,
      scan_id: scanId,
      query_type: queryType,
      target_domain: domain,
      result: resultPayload,
      error_message: errorMessage,
    })
    .select("id, query_id, scan_id, query_type, target_domain, result, error_message, created_at")
    .single();

  await writeAudit(supabase, user.id, status === "completed" ? "query_completed" : "query_failed", queryId, {
    query_type: queryType,
    target_domain: domain,
    error: errorMessage,
  });

  if (resultErr || !resultRow) {
    return { error: resultErr?.message ?? "Failed to store result." };
  }

  revalidatePath("/dashboard/intel");
  if (scanId) revalidatePath(`/dashboard/scans/${scanId}`);

  return {
    ok: true,
    result: {
      ...resultRow,
      result: resultRow.result as Record<string, unknown>,
    },
  };
}

export async function listMyVaultResults(limit = 30): Promise<VaultResultRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("intel_vault_results")
    .select("id, query_id, scan_id, query_type, target_domain, result, error_message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (rows ?? []).map((r: VaultResultRow) => ({
    ...r,
    result: (r.result ?? {}) as Record<string, unknown>,
  }));
}

export async function listVaultResultsForScan(scanId: string): Promise<VaultResultRow[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  const owned = await verifyScanOwnership(supabase, user.id, scanId);
  if (!owned) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("intel_vault_results")
    .select("id, query_id, scan_id, query_type, target_domain, result, error_message, created_at")
    .eq("user_id", user.id)
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (rows ?? []).map((r: VaultResultRow) => ({
    ...r,
    result: (r.result ?? {}) as Record<string, unknown>,
  }));
}
