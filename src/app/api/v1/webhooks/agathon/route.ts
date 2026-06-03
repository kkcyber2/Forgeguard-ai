import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeRiskLabel,
  prepareScanReportUpsert,
} from "@/lib/agathon/payload-numerics";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/v1/webhooks/agathon
 * ---------------------------
 * Ingress for Supabase Database Webhooks and engine completion callbacks.
 * Configure in Supabase Dashboard → Database → Webhooks → this URL.
 *
 * Auth: Authorization: Bearer <AGATHON_WEBHOOK_SECRET>
 *       or x-agathon-webhook-secret header (same value).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookBody = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  event?: string;
  scan_id?: string;
  kind?: string;
  payload?: Record<string, unknown>;
};

function resolveSecret(request: NextRequest): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice(7).trim();
  }
  return request.headers.get("x-agathon-webhook-secret")?.trim() ?? null;
}

function normalizeScanStatus(raw: unknown): string {
  const status = String(raw ?? "sealed").trim().toLowerCase();
  if (status === "completed" || status === "success") return "sealed";
  if (status === "sealed" || status === "failed" || status === "probing") {
    return status;
  }
  return "sealed";
}

function verifyWebhook(request: NextRequest): boolean {
  const expected =
    process.env.AGATHON_WEBHOOK_SECRET ??
    process.env.INTERNAL_SCAN_TOKEN ??
    process.env.AGATHON_INTERNAL_SECRET;
  if (!expected) return false;
  const provided = resolveSecret(request);
  return provided === expected;
}

/**
 * Normalize Supabase DB webhook payloads and manual engine posts.
 */
function normalizeEvent(body: WebhookBody): {
  kind: string;
  scanId: string | null;
  table: string | null;
} {
  if (body.kind) {
    return {
      kind: body.kind,
      scanId: (body.scan_id as string) ?? null,
      table: null,
    };
  }
  const table = body.table ?? body.type ?? "unknown";
  const event = body.event ?? body.type ?? "INSERT";
  const record = body.record ?? {};
  const scanId =
    (record.scan_id as string) ??
    (record.id as string) ??
    body.scan_id ??
    null;
  return {
    kind: `${table}.${event}`.toLowerCase(),
    scanId,
    table: String(table),
  };
}

export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = normalizeEvent(body);
  const admin = createAdminSupabase();

  if (event.scanId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("scan_logs").insert({
        scan_id: event.scanId,
        type: "webhook",
        severity: "info",
        attack_name: "webhook_agathon",
        payload: {
          message: "Agathon webhook received",
          kind: event.kind,
          table: event.table,
          record_preview: body.record
            ? Object.keys(body.record).slice(0, 12)
            : [],
          engine_payload: body.payload ?? null,
        },
      });
    } catch (err) {
      console.warn("[webhook:agathon] scan_logs insert skipped:", err);
    }
  }

  if (event.kind === "scan.completed" && event.scanId && body.payload) {
    const p = body.payload;
    const technicalReport =
      typeof p.technical_report_md === "string" ? p.technical_report_md : null;
    const aleUsd = p.ale_usd ?? p.financial_liability_usd ?? null;
    const attacksRun = p.attacks_run != null ? String(p.attacks_run) : "0";
    const findingsArr = Array.isArray(p.findings) ? p.findings : [];
    const defaultPoc = `Status: Clean. Total Vectors Tested: ${attacksRun}. No exploitable vulnerabilities detected.`;
    try {
      const scanStatus = normalizeScanStatus(p.status);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: scanUpdateErr } = await (admin as any)
        .from("scans")
        .update({
          status: scanStatus,
          progress_pct: 100,
          completed_at: new Date().toISOString(),
          ...(p.failure_reason
            ? { failure_reason: String(p.failure_reason) }
            : {}),
        })
        .eq("id", event.scanId);
      if (scanUpdateErr) {
        throw new Error(`scans.update: ${scanUpdateErr.message}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (admin as any)
        .from("scan_reports")
        .select(
          "findings, executive_summary_md, audit_report_md, ale_usd, financial_liability_usd",
        )
        .eq("scan_id", event.scanId)
        .maybeSingle();

      const parsedAle =
        aleUsd != null ? Number.parseFloat(String(aleUsd)) : null;
      const riskLabel = normalizeRiskLabel(
        p.overall_severity ?? existing?.risk_label ?? "NONE",
      );

      const pocText =
        typeof p.technical_proof_of_concept === "string" &&
        p.technical_proof_of_concept.trim()
          ? p.technical_proof_of_concept
          : findingsArr.length === 0
            ? defaultPoc
            : undefined;

      const parsedAttacksRun =
        p.attacks_run != null ? Number.parseFloat(String(p.attacks_run)) : 0;
      const attacksRunInt = Number.isNaN(parsedAttacksRun)
        ? 0
        : Math.round(parsedAttacksRun);
      const parsedCvss =
        p.overall_cvss != null ? Number.parseFloat(String(p.overall_cvss)) : 0;

      const executiveMd =
        (typeof p.executive_summary === "string" && p.executive_summary.trim()
          ? p.executive_summary
          : null) ??
        existing?.executive_summary_md ??
        (technicalReport ? technicalReport.slice(0, 4000) : null) ??
        pocText ??
        defaultPoc;

      const patch: Record<string, unknown> = {
        scan_id: event.scanId,
        generator_model: "llama-3.3-70b-versatile",
        executive_summary_md: executiveMd,
        cvss_overall: Number.isNaN(parsedCvss) ? 0 : parsedCvss,
        risk_label: riskLabel,
        findings: findingsArr,
        attacks_run: attacksRunInt,
      };

      if (typeof p.executive_summary === "string") {
        patch.executive_summary = p.executive_summary;
      }
      if (pocText) {
        patch.technical_proof_of_concept = pocText;
      }
      if (typeof p.remediation_code_snippet === "string") {
        patch.remediation_code_snippet = p.remediation_code_snippet;
      }
      if (technicalReport) {
        patch.audit_report_md = technicalReport;
      }
      if (parsedAle != null && !Number.isNaN(parsedAle)) {
        patch.financial_liability_usd = parsedAle;
        patch.ale_usd = parsedAle;
      }

      const prepared = prepareScanReportUpsert(patch);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertErr } = await (admin as any)
        .from("scan_reports")
        .upsert(prepared, { onConflict: "scan_id" });
      if (upsertErr) {
        throw new Error(`scan_reports.upsert: ${upsertErr.message}`);
      }

      // #region agent log
      fetch("http://127.0.0.1:7434/ingest/9739fdfe-4a94-4d0e-8d13-8449868d349d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c20499",
        },
        body: JSON.stringify({
          sessionId: "c20499",
          runId: "post-fix",
          hypothesisId: "E",
          location: "route.ts:scan.completed",
          message: "scan_reports_upsert_ok",
          data: {
            scanId: event.scanId,
            riskLabel: prepared.risk_label,
            attacksRun: prepared.attacks_run,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : String(err);
      console.warn("[webhook:agathon] scan.completed persist skipped:", detail);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("scan_logs").insert({
          scan_id: event.scanId,
          type: "info",
          severity: "high",
          attack_name: "webhook_persist_failed",
          payload: {
            message: detail.slice(0, 500),
            kind: event.kind,
          },
        });
      } catch {
        /* best-effort production evidence */
      }
      // #region agent log
      fetch("http://127.0.0.1:7434/ingest/9739fdfe-4a94-4d0e-8d13-8449868d349d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c20499",
        },
        body: JSON.stringify({
          sessionId: "c20499",
          runId: "post-fix",
          hypothesisId: "E",
          location: "route.ts:scan.completed",
          message: "scan_reports_upsert_failed",
          data: { scanId: event.scanId, detail: detail.slice(0, 400) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  if (event.kind.includes("scans") && event.scanId && body.record) {
    const status = body.record.status as string | undefined;
    const progress = body.record.progress_pct as number | undefined;
    if (status || progress != null) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("scans")
          .update({
            ...(status ? { status } : {}),
            ...(progress != null ? { progress_pct: progress } : {}),
          })
          .eq("id", event.scanId);
      } catch {
        /* idempotent — row may already be current via Realtime writer */
      }
    }
  }

  return NextResponse.json({
    ok: true,
    received: event.kind,
    scan_id: event.scanId,
  });
}

export async function GET() {
  return NextResponse.json({
    service: "agathon-webhook",
    status: "ready",
    usage: "POST with Bearer AGATHON_WEBHOOK_SECRET",
  });
}
