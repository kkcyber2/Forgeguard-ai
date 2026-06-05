/**
 * Trigger Sovereign Customs audit on the Railway engine.
 */

import {
  engineAuthHeaders,
  ENGINE_HANDSHAKE_TIMEOUT_MS,
  resolveEngineBaseUrl,
} from "@/lib/agathon-config";

export type BazaarEngineAuditResult = {
  ok: boolean;
  script_id: string;
  verdict: "cleared" | "flagged" | "rejected";
  status: string;
  risk_score: number;
  findings: string[];
  reason: string;
  remediation_advice?: string;
  is_certified?: boolean;
  is_published?: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
};

export async function triggerBazaarAudit(
  scriptId: string,
): Promise<BazaarEngineAuditResult> {
  const base = resolveEngineBaseUrl();
  const headers = engineAuthHeaders();

  if (!base || !headers) {
    return {
      ok: false,
      script_id: scriptId,
      verdict: "flagged",
      status: "flagged",
      risk_score: 40,
      findings: ["Engine URL or INTERNAL_SCAN_TOKEN not configured"],
      reason: "Customs engine unreachable — manual review required.",
      error: "ENGINE_UNCONFIGURED",
    };
  }

  const url = `${base.replace(/\/+$/, "")}/bazaar/audit/${scriptId}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(ENGINE_HANDSHAKE_TIMEOUT_MS),
      cache: "no-store",
    });

    const data = (await resp.json().catch(() => ({}))) as BazaarEngineAuditResult;

    if (!resp.ok) {
      return {
        ok: false,
        script_id: scriptId,
        verdict: "flagged",
        status: "flagged",
        risk_score: data.risk_score ?? 50,
        findings: data.findings ?? [data.error ?? `Engine ${resp.status}`],
        reason: data.reason ?? "Customs audit failed.",
        error: data.error ?? `HTTP ${resp.status}`,
      };
    }

    return {
      ok: true,
      script_id: scriptId,
      verdict: data.verdict ?? "flagged",
      status: data.status ?? data.verdict ?? "flagged",
      risk_score: data.risk_score ?? 0,
      findings: Array.isArray(data.findings) ? data.findings : [],
      reason: data.reason ?? "",
      remediation_advice: data.remediation_advice,
      is_certified: data.is_certified,
      is_published: data.is_published,
      metadata: data.metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      script_id: scriptId,
      verdict: "flagged",
      status: "flagged",
      risk_score: 45,
      findings: [`Engine audit error: ${message}`],
      reason: "Customs engine timeout — manual review required.",
      error: message,
    };
  }
}
