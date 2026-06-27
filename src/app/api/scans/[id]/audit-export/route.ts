import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { createServerSupabase, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { resolveAccessRank } from "@/lib/access/ranks";
import { verifyAuditChain } from "@/lib/compliance/audit-chain";
import { mapFindingToOwaspLlm } from "@/lib/compliance/owasp-llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scans/[id]/audit-export
 * --------------------------------
 * Tamper-evident compliance evidence pack for a single scan.
 *
 * Authorization (any one):
 *   - scan.user_id === session user (owner)
 *   - isSovereignOperator(email)
 *   - admin (access rank ≥ 5)
 * Non-owners get 404 (no existence leak).
 *
 * Returns a canonical JSON pack + pack_signature (HMAC-SHA256 over the
 * canonical body using SCAN_CREDENTIAL_SECRET).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;

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

  // 1. Scan row -----------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scan, error: scanErr } = (await (admin as any)
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .maybeSingle()) as {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  };

  if (scanErr || !scan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scanOwnerId = String(scan.user_id ?? "");
  const authorized = scanOwnerId === user.id || sovereign || isAdmin;
  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Legal authorization linked to this scan ----------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: legalAuth } = (await (admin as any)
    .from("legal_authorizations")
    .select(
      "id, user_id, intensity, consented, full_name, policy_version, target_host, signature_hash, signed_at, created_at",
    )
    .eq("scan_id", scanId)
    .maybeSingle()) as { data: Record<string, unknown> | null };

  // 3. Audit chain --------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRows } = (await (admin as any)
    .from("scan_audit_events")
    .select("event, policy_version, event_hash, prev_hash, created_at")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true })) as {
    data: Array<Record<string, unknown>> | null;
  };

  let chainValid = false;
  let chainLength = 0;
  try {
    const verification = await verifyAuditChain(admin, scanId);
    chainValid = verification.valid;
    chainLength = verification.length;
  } catch (err) {
    console.warn("[audit-export] chain verify failed:", err);
  }

  // 4. Findings summary ---------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: report } = (await (admin as any)
    .from("scan_reports")
    .select("findings, risk_label, cvss_overall, attacks_run")
    .eq("scan_id", scanId)
    .maybeSingle()) as {
    data: {
      findings: unknown;
      risk_label: string | null;
      cvss_overall: number | null;
      attacks_run: number | null;
    } | null;
  };

  const findingsRaw = Array.isArray(report?.findings) ? (report!.findings as Array<Record<string, unknown>>) : [];
  const findings = findingsRaw.map((f) => {
    const family = String(f.family ?? f.attack ?? f.attack_name ?? "unknown");
    const owasp = mapFindingToOwaspLlm(family);
    return {
      attack: String(f.attack ?? f.attack_name ?? family),
      family,
      severity: String(f.severity ?? "info"),
      success: Boolean(f.success ?? false),
      owasp: owasp.code,
      owasp_label: owasp.label,
    };
  });

  // OWASP coverage across all findings (distinct, sorted).
  const owaspMapping = [
    ...new Map(findings.map((f) => [f.owasp, f])).values(),
  ]
    .sort((a, b) => a.owasp.localeCompare(b.owasp))
    .map((f) => ({ code: f.owasp, label: f.owasp_label }));

  // 5. Canonical pack -----------------------------------------------------
  const generatedAt = new Date().toISOString();

  const pack = {
    scan: {
      id: scan.id,
      user_id: scan.user_id,
      target_model: scan.target_model,
      target_url: scan.target_url,
      intensity: scan.intensity,
      surface_kind: scan.surface_kind,
      status: scan.status,
      finding_count: scan.finding_count ?? 0,
      high_severity_count: scan.high_severity_count ?? 0,
      ale_usd: scan.ale_usd ?? null,
      created_at: scan.created_at,
      completed_at: scan.completed_at ?? null,
    },
    scope: {
      scope_host: scan.scope_host ?? null,
      scope_verified_at: scan.scope_verified_at ?? null,
      target_host: normalizeHostFromUrl(String(scan.target_url ?? "")),
    },
    legal_authorization: legalAuth
      ? {
          id: legalAuth.id,
          intensity: legalAuth.intensity,
          consented: legalAuth.consented,
          signer_name: legalAuth.full_name,
          policy_version: legalAuth.policy_version,
          target_host: legalAuth.target_host,
          signature_hash: legalAuth.signature_hash,
          signed_at: legalAuth.signed_at,
        }
      : null,
    audit_chain: {
      valid: chainValid,
      length: chainLength,
      events: (auditRows ?? []).map((r) => ({
        event: r.event,
        policy_version: r.policy_version ?? null,
        event_hash: r.event_hash,
        prev_hash: r.prev_hash ?? null,
        created_at: r.created_at,
      })),
    },
    chain_valid: chainValid,
    findings,
    owasp_mapping: owaspMapping,
    report: report
      ? {
          risk_label: report.risk_label,
          cvss_overall: report.cvss_overall,
          attacks_run: report.attacks_run,
        }
      : null,
    generated_at: generatedAt,
  };

  const canonicalJson = JSON.stringify(pack);
  const secret = process.env.SCAN_CREDENTIAL_SECRET;
  const pack_signature = secret
    ? createHmac("sha256", secret).update(canonicalJson, "utf8").digest("hex")
    : null;

  return NextResponse.json({ ...pack, pack_signature });
}

function normalizeHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
