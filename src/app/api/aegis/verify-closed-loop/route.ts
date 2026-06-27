import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { resolveAccessRank } from "@/lib/access/ranks";
import { verifyRuleBlocksAttack } from "@/lib/aegis/closed-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aegis/verify-closed-loop?scanId=<uuid>&findingId=<id>
 * ----------------------------------------------------------------
 * Phase 3 — Aegis closed-loop proof.
 *
 * For each finding (or a single findingId) on a scan, proves whether the
 * Aegis WAF rule generated for that finding's technique would block the
 * exact attack payload that succeeded. Pure local proof — no live target.
 *
 * Authorization (any one): scan owner · sovereign operator · admin (rank ≥ 5).
 * Non-owners get 404 (no existence leak). Persists
 * `aegis_rules.verified_blocks_attack` for each matched rule.
 */
export async function GET(req: NextRequest) {
  const scanId = req.nextUrl.searchParams.get("scanId");
  const findingId = req.nextUrl.searchParams.get("findingId");

  if (!scanId) {
    return NextResponse.json({ error: "scanId required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const profile = await getCurrentProfile();
  const rank = resolveAccessRank(profile?.access_level ?? 1, profile?.role ?? null);
  const sovereign = isSovereignOperator(user.email);
  const isAdmin = rank >= 5;

  const admin = createAdminSupabase();

  // 1. Scan ownership -----------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scan, error: scanErr } = (await (admin as any)
    .from("scans")
    .select("id, user_id")
    .eq("id", scanId)
    .maybeSingle()) as {
    data: { id: string; user_id: string } | null;
    error: { message: string } | null;
  };

  if (scanErr || !scan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authorized = scan.user_id === user.id || sovereign || isAdmin;
  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Findings to prove --------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findings } = (await (admin as any)
    .from("scan_logs")
    .select("id, attack_name, severity, type")
    .eq("scan_id", scanId)
    .in("type", ["finding", "attempt", "breach", "strike"])
    .order("created_at", { ascending: true })
    .limit(100)) as {
    data: Array<{ id: string; attack_name: string | null; severity: string; type: string }> | null;
  };

  const rows = findings ?? [];
  const targets = findingId ? rows.filter((r) => r.id === findingId) : rows;

  // 3. Prove each ---------------------------------------------------------
  const results = [];
  for (const row of targets) {
    const proof = await verifyRuleBlocksAttack(admin, scanId, row.id);
    results.push({
      findingId: row.id,
      attack_name: row.attack_name,
      severity: row.severity,
      technique: proof.technique ?? null,
      ruleId: proof.ruleId ?? null,
      verified: proof.verified,
      afterBlocked: proof.afterBlocked,
      error: proof.error ?? null,
    });
  }

  const verifiedCount = results.filter((r) => r.verified).length;

  return NextResponse.json({
    scanId,
    summary: {
      total: results.length,
      verified: verifiedCount,
      notVerified: results.length - verifiedCount,
    },
    results,
  });
}
