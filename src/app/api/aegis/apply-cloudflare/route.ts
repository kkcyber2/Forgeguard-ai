import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { resolveAccessRank } from "@/lib/access/ranks";
import { buildCloudflareRuleset, type ScanFinding } from "@/lib/aegis/ruleset-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aegis/apply-cloudflare?scanId=<uuid>&mode=dry-run|apply
 * ----------------------------------------------------------------
 * Phase 3E — Cloudflare WAF ruleset synthesis + (gated) deployment.
 *
 * - mode=dry-run (DEFAULT): returns the CloudflareRuleset JSON that *would* be
 *   pushed. No external call. Safe for any scan owner.
 * - mode=apply: pushes the ruleset to Cloudflare via CLOUDFLARE_API_TOKEN +
 *   CLOUDFLARE_ZONE_ID and records the returned ruleset id on
 *   aegis_rules.cloudflare_rule_id. Gated to enterprise (sovereign or rank≥5)
 *   and to env presence. Never auto-applied.
 */

interface CloudflareApiResponse {
  success: boolean;
  errors: unknown[];
  messages: unknown[];
  result?: { id?: string; name?: string; phase?: string };
}

export async function GET(req: NextRequest) {
  const scanId = req.nextUrl.searchParams.get("scanId");
  const mode = req.nextUrl.searchParams.get("mode") === "apply" ? "apply" : "dry-run";

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
  const isEnterprise = sovereign || isAdmin;

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
  if (scan.user_id !== user.id && !sovereign && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Build the ruleset from scan findings -------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findings } = (await (admin as any)
    .from("scan_logs")
    .select("id, type, severity, attack_name, payload, created_at")
    .eq("scan_id", scanId)
    .in("type", ["finding", "attempt", "breach", "strike"])
    .order("created_at", { ascending: true })
    .limit(100)) as { data: ScanFinding[] | null };

  const effective: ScanFinding[] = (findings && findings.length)
    ? findings
    : [
        {
          id: 0,
          type: "finding",
          severity: "medium",
          attack_name: "prompt_injection",
          payload: null,
          created_at: new Date().toISOString(),
        },
      ];

  const ruleset = buildCloudflareRuleset(scanId, effective);

  // 3. Dry-run — return JSON only ----------------------------------------
  if (mode === "dry-run") {
    return NextResponse.json({
      mode: "dry-run",
      scanId,
      ruleset,
      note: "Dry-run only. No Cloudflare API call was made. Pass mode=apply (enterprise) to deploy.",
    });
  }

  // 4. Apply — enterprise gate + env gate --------------------------------
  if (!isEnterprise) {
    return NextResponse.json(
      { error: "apply mode is enterprise-only", mode: "dry-run", ruleset },
      { status: 403 },
    );
  }

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!apiToken || !zoneId) {
    return NextResponse.json(
      {
        error: "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not configured",
        mode: "dry-run",
        ruleset,
      },
      { status: 503 },
    );
  }

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: ruleset.name,
        description: ruleset.description,
        kind: "custom",
        phase: "http_request_firewall_custom",
        rules: ruleset.rules.map((r) => ({
          description: r.description,
          expression: r.expression,
          action: r.action,
          enabled: r.enabled,
          ref: r.ref,
        })),
      }),
    },
  );

  const cfJson = (await cfRes.json()) as CloudflareApiResponse;
  if (!cfRes.ok || !cfJson.success || !cfJson.result?.id) {
    return NextResponse.json(
      {
        error: "Cloudflare API rejected the ruleset",
        cloudflare_errors: cfJson.errors,
        mode: "apply",
        ruleset,
      },
      { status: 502 },
    );
  }

  const cloudflareRuleId = cfJson.result.id;

  // 5. Record the deployed ruleset id on the scan's aegis_rules -----------
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("aegis_rules")
      .update({ cloudflare_rule_id: cloudflareRuleId })
      .eq("scan_id", scanId);
  } catch {
    // Non-fatal — deployment already succeeded.
  }

  return NextResponse.json({
    mode: "apply",
    scanId,
    cloudflare_rule_id: cloudflareRuleId,
    cloudflare_phase: cfJson.result.phase ?? "http_request_firewall_custom",
    rule_count: ruleset.rules.length,
    ruleset,
  });
}
