import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeRiskLabel,
  prepareScanReportUpsert,
} from "@/lib/agathon/payload-numerics";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  applyFortressBlock,
  verifyWebhookToken,
} from "@/services/fortress-perimeter.service";
import { logBlacklistedEntity } from "@/services/scraper-defense.service";

/**
 * POST /api/v1/webhooks/agathon
 * ---------------------------
 * Ingress for Supabase Database Webhooks and engine completion callbacks.
 *
 * Auth: x-internal-scan-token or Authorization: Bearer (mirrors Railway handshake).
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

function verifyWebhook(request: NextRequest): boolean {
  return verifyWebhookToken(request);
}

function rejectUnauthorizedWebhook(request: NextRequest): NextResponse {
  logBlacklistedEntity(request, "webhook_token_violation");
  const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  applyFortressBlock(res);
  return res;
}

function normalizeScanStatus(raw: unknown): string {
  const status = String(raw ?? "sealed").trim().toLowerCase();
  if (status === "completed" || status === "success") return "sealed";
  if (status === "sealed" || status === "failed" || status === "probing") {
    return status;
  }
  return "sealed";
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
    return rejectUnauthorizedWebhook(request);
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = normalizeEvent(body);
  const admin = createAdminSupabase();
  let persistOk: boolean | null = null;
  let persistError: string | null = null;

  if (event.scanId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: ingressErr } = await (admin as any).from("scan_logs").insert({
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
    if (ingressErr) {
      console.warn("[webhook:agathon] scan_logs webhook type failed:", ingressErr.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("scan_logs").insert({
        scan_id: event.scanId,
        type: "info",
        severity: "info",
        attack_name: "webhook_agathon",
        payload: {
          message: "Agathon webhook received (info fallback)",
          kind: event.kind,
          ingress_error: ingressErr.message.slice(0, 200),
        },
      });
    }
  }

  if (event.kind === "scan.completed" && event.scanId && body.payload) {
    const p = body.payload;
    const technicalReport =
      typeof p.technical_report_md === "string" ? p.technical_report_md : null;
    const aleUsd = p.ale_usd ?? p.financial_liability_usd ?? null;
    const findingsArr = Array.isArray(p.findings) ? p.findings : [];
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

      const parsedAttacksRun =
        p.attacks_run != null ? Number.parseFloat(String(p.attacks_run)) : 0;
      const attacksRunInt = Number.isNaN(parsedAttacksRun)
        ? 0
        : Math.round(parsedAttacksRun);
      const parsedCvss =
        p.overall_cvss != null ? Number.parseFloat(String(p.overall_cvss)) : 0;

      const zeroFindings = findingsArr.length === 0;
      const securePoc = `${attacksRunInt} vectors tested. Perimeter intake is healthy.`;
      const securePocFull = `Status: Secure\n${securePoc}`;

      const pocText =
        typeof p.technical_proof_of_concept === "string" &&
        p.technical_proof_of_concept.trim()
          ? p.technical_proof_of_concept.trim()
          : zeroFindings
            ? securePocFull
            : "";

      const executiveMd =
        (typeof p.executive_summary === "string" && p.executive_summary.trim()
          ? p.executive_summary
          : null) ??
        existing?.executive_summary_md ??
        (technicalReport ? technicalReport.slice(0, 4000) : null) ??
        (zeroFindings
          ? `Status: Secure — ${securePoc}`
          : pocText || "Scan complete.");

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
      patch.technical_proof_of_concept = pocText || (zeroFindings ? securePocFull : null);
      if (typeof p.remediation_code_snippet === "string") {
        patch.remediation_code_snippet = p.remediation_code_snippet;
      }
      if (technicalReport) {
        patch.audit_report_md = technicalReport;
      }
      if (parsedAle != null && !Number.isNaN(parsedAle)) {
        patch.financial_liability_usd = parsedAle;
        patch.ale_usd = parsedAle;
      } else if (zeroFindings) {
        patch.financial_liability_usd = 0;
        patch.ale_usd = 0;
      }

      const prepared = prepareScanReportUpsert(patch);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertErr } = await (admin as any)
        .from("scan_reports")
        .upsert(prepared, { onConflict: "scan_id" });
      if (upsertErr) {
        throw new Error(`scan_reports.upsert: ${upsertErr.message}`);
      }

      persistOk = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("scan_logs").insert({
        scan_id: event.scanId,
        type: "info",
        severity: "info",
        attack_name: "webhook_persist_ok",
        payload: {
          message: "scan.completed persisted",
          risk_label: prepared.risk_label,
          attacks_run: prepared.attacks_run,
        },
      });
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : String(err);
      persistOk = false;
      persistError = detail;
      console.error("[webhook_persist_failed]", {
        scanId: event.scanId,
        kind: event.kind,
        error: detail.slice(0, 500),
      });
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
    }
  }

  if (event.kind === "status_update" && event.scanId && body.payload) {
    const p = body.payload;
    const progressRaw = p.progress_pct;
    const progressPct =
      progressRaw != null ? Number.parseFloat(String(progressRaw)) : null;
    try {
      if (
        progressPct != null &&
        !Number.isNaN(progressPct) &&
        progressPct > 0
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("scans")
          .update({
            status: "probing",
            progress_pct: Math.round(progressPct),
          })
          .eq("id", event.scanId);
      }
      persistOk = true;
    } catch (err) {
      persistOk = false;
      persistError = err instanceof Error ? err.message : String(err);
      console.error("[webhook_persist_failed]", {
        scanId: event.scanId,
        kind: event.kind,
        error: persistError.slice(0, 500),
      });
    }
  }

  if (event.kind === "scan.vector.breach" && event.scanId && body.payload) {
    const p = body.payload;
    const aleUsd = p.ale_usd ?? p.financial_liability_usd ?? null;
    try {
      const parsedAle =
        aleUsd != null ? Number.parseFloat(String(aleUsd)) : null;
      const executiveMd =
        (typeof p.executive_summary_md === "string" &&
        p.executive_summary_md.trim()
          ? p.executive_summary_md
          : null) ??
        (typeof p.executive_summary === "string" && p.executive_summary.trim()
          ? p.executive_summary
          : null) ??
        `Vector breach: ${String(p.probe ?? "unknown")}`;

      const parsedAttacksRun =
        p.attacks_run != null ? Number.parseFloat(String(p.attacks_run)) : null;
      const attacksRunInt =
        parsedAttacksRun != null && !Number.isNaN(parsedAttacksRun)
          ? Math.round(parsedAttacksRun)
          : undefined;

      const patch: Record<string, unknown> = {
        scan_id: event.scanId,
        generator_model: "llama-3.3-70b-versatile",
        executive_summary_md: executiveMd,
        risk_label: normalizeRiskLabel(p.severity ?? "HIGH"),
      };
      if (attacksRunInt != null && attacksRunInt >= 0) {
        patch.attacks_run = attacksRunInt;
      }
      if (typeof p.executive_summary === "string") {
        patch.executive_summary = p.executive_summary;
      }
      if (typeof p.technical_proof_of_concept === "string") {
        patch.technical_proof_of_concept = p.technical_proof_of_concept;
      }
      if (typeof p.remediation_code_snippet === "string") {
        patch.remediation_code_snippet = p.remediation_code_snippet;
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
        throw new Error(`scan_reports.vector_breach: ${upsertErr.message}`);
      }

      const progressRaw = p.progress_pct;
      const progressPct =
        progressRaw != null ? Number.parseFloat(String(progressRaw)) : null;
      if (progressPct != null && !Number.isNaN(progressPct) && progressPct > 2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("scans")
          .update({ progress_pct: Math.round(progressPct) })
          .eq("id", event.scanId);
      }

      persistOk = true;
    } catch (err) {
      persistOk = false;
      persistError =
        err instanceof Error ? err.message : String(err);
      console.error("[webhook_persist_failed]", {
        scanId: event.scanId,
        kind: event.kind,
        error: persistError.slice(0, 500),
      });
      console.warn(
        "[webhook:agathon] scan.vector.breach persist skipped:",
        persistError,
      );
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
    persist_ok: persistOk,
    persist_error: persistError,
    received: event.kind,
    scan_id: event.scanId,
  });
}

export async function GET(request: NextRequest) {
  logBlacklistedEntity(request, "webhook_method_violation");
  const res = NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  applyFortressBlock(res);
  return res;
}
