import { NextResponse, type NextRequest } from "next/server";
import { stringifyPayloadNumerics } from "@/lib/agathon/payload-numerics";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("scans")
        .update({
          status: (p.status as string) ?? "completed",
          progress_pct: 100,
          ...(p.failure_reason
            ? { failure_reason: String(p.failure_reason) }
            : {}),
        })
        .eq("id", event.scanId);

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
      const riskRaw = p.overall_severity ?? existing?.risk_label ?? "NONE";
      const riskLabel = String(riskRaw).toUpperCase();

      const pocText =
        typeof p.technical_proof_of_concept === "string" &&
        p.technical_proof_of_concept.trim()
          ? p.technical_proof_of_concept
          : findingsArr.length === 0
            ? defaultPoc
            : undefined;

      const parsedAttacksRun =
        p.attacks_run != null ? Number.parseFloat(String(p.attacks_run)) : null;

      const patch: Record<string, unknown> = {
        scan_id: event.scanId,
        cvss_overall:
          p.overall_cvss != null
            ? Number.parseFloat(String(p.overall_cvss))
            : undefined,
        risk_label: riskLabel,
        findings: stringifyPayloadNumerics(findingsArr),
        ...(parsedAttacksRun != null && !Number.isNaN(parsedAttacksRun)
          ? { attacks_run: parsedAttacksRun }
          : {}),
      };

      if (typeof p.executive_summary === "string") {
        patch.executive_summary = p.executive_summary;
        patch.executive_summary_md =
          p.executive_summary || existing?.executive_summary_md || "";
      } else if (technicalReport) {
        patch.executive_summary_md =
          existing?.executive_summary_md ?? technicalReport.slice(0, 4000);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("scan_reports").upsert(
        stringifyPayloadNumerics(patch) as Record<string, unknown>,
        { onConflict: "scan_id" },
      );
    } catch (err) {
      console.warn("[webhook:agathon] scan.completed persist skipped:", err);
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
