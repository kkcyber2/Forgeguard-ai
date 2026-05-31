import { NextResponse, type NextRequest } from "next/server";
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
        type: "info",
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
