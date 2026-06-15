import "server-only";

import {
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
  engineAuthHeaders,
  ENGINE_HANDSHAKE_TIMEOUT_MS,
  joinEnginePath,
} from "@/lib/agathon-config";
import { stringifyPayloadNumerics } from "@/lib/agathon/payload-numerics";
import { isSovereignOperator } from "@/lib/access/sovereign-operator";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { openCredential } from "@/lib/crypto/credentials";
import type { Database } from "@/types/supabase";

/**
 * Vercel → Railway scan dispatcher.
 * ---------------------------------
 *
 * runScan() is invoked from /api/scan/start. On Vercel it CANNOT spawn
 * Python (no interpreter) and CANNOT keep work running after the HTTP
 * response is sent (serverless function terminates). So this version
 * forwards the scan to the long-lived FastAPI orchestrator running on
 * Railway, which actually executes the attacks.
 *
 * Flow:
 *   1. Load the scan row with the service-role client (bypasses RLS).
 *   2. Decrypt the target API key with our AES-GCM secret.
 *   3. POST to ${AGATHON_ORCHESTRATOR_URL}/scan/start with bearer auth.
 *      target_url and api_key are sent exactly as stored on the scan row
 *      (no URL normalization or provider inference on the dispatcher).
 *   4. The orchestrator emits to scan_logs over Postgres + WebSocket.
 *
 * Required env vars (Vercel side):
 *   - PYTHON_ENGINE_URL (or AGATHON_ORCHESTRATOR_URL) : Railway public URL
 *   - INTERNAL_SCAN_TOKEN (or AGATHON_INTERNAL_SECRET) : bearer shared w/ Railway
 *   - SCAN_CREDENTIAL_SECRET   : AES key for unsealing the API key
 *   - SUPABASE_SERVICE_ROLE_KEY : service-role for admin DB writes
 */

type ScanStatus = Database["public"]["Tables"]["scans"]["Row"]["status"];
type LogType = Database["public"]["Tables"]["scan_logs"]["Insert"]["type"];
type LogSeverity = Database["public"]["Tables"]["scan_logs"]["Insert"]["severity"];

interface RunnerEvent {
  type: LogType;
  severity?: LogSeverity;
  attack_name?: string | null;
  payload?: unknown;
}

interface RunScanOptions {
  scanId: string;
  userId: string;
}

export async function runScan({ scanId, userId }: RunScanOptions): Promise<void> {
  const admin = createAdminSupabase();

  // 1. Load scan row -------------------------------------------------------
  const { data: scan, error: scanErr } = (await admin
    .from("scans")
    .select(
      "id, user_id, target_model, target_url, target_credential_encrypted, intensity, surface_kind, asset_value_usd",
    )
    .eq("id", scanId)
    .maybeSingle()) as {
    data: {
      id: string;
      user_id: string;
      target_model: string;
      target_url: string;
      target_credential_encrypted: string | null;
      intensity: string | null;
      surface_kind: string | null;
      asset_value_usd: number | null;
    } | null;
    error: { message: string } | null;
  };

  if (scanErr || !scan) {
    console.error("[runner] could not load scan:", scanErr?.message);
    return;
  }
  if (scan.user_id !== userId) {
    console.error("[runner] user/scan mismatch — refusing to run");
    return;
  }

  const { data: profile } = (await admin
    .from("profiles")
    .select("email, is_ghost_active")
    .eq("id", userId)
    .maybeSingle()) as {
    data: { email: string | null; is_ghost_active: boolean | null } | null;
  };
  const sovereign = isSovereignOperator(profile?.email);
  const isGhostActive = Boolean(profile?.is_ghost_active);

  // 2. Decrypt the target API key -----------------------------------------
  let apiKey: string;
  try {
    if (!scan.target_credential_encrypted) {
      throw new Error("No credential on scan row");
    }
    apiKey = openCredential(scan.target_credential_encrypted);
  } catch (e) {
    await markFailure(
      admin,
      scanId,
      `Could not unseal target credential: ${(e as Error).message}`,
    );
    return;
  }

  // 3. Raw dispatch — URL and key exactly as entered in the scan form --------
  const targetUrl = scan.target_url;
  const targetApiKey = apiKey;

  // 4. Validate Railway env vars before dispatch -------------------------
  const orchestratorUrl = resolveEngineBaseUrl();
  const internalSecret = resolveEngineAuthToken();
  if (!orchestratorUrl) {
    console.error(
      "[runner] Missing PYTHON_ENGINE_URL (or AGATHON_ORCHESTRATOR_URL fallback)",
    );
    await markFailure(
      admin,
      scanId,
      "PYTHON_ENGINE_URL (or AGATHON_ORCHESTRATOR_URL) is not configured on Vercel.",
    );
    return;
  }
  if (!internalSecret) {
    console.error(
      "[runner] Missing INTERNAL_SCAN_TOKEN (or AGATHON_INTERNAL_SECRET fallback)",
    );
    await markFailure(
      admin,
      scanId,
      "INTERNAL_SCAN_TOKEN (or AGATHON_INTERNAL_SECRET) is not configured on Vercel.",
    );
    return;
  }

  // 5. Mark scan as probing + emit a kickoff log -------------------------
  await transitionStatus(admin, scanId, "probing", { progress_pct: 3 });
  await emit(admin, scanId, {
    type: "info",
    severity: "info",
    payload: {
      message: "Dispatching to Agathon orchestrator on Railway (raw URL/key)",
      target_model: scan.target_model,
      target_url: targetUrl,
      intensity: scan.intensity ?? "standard",
    },
  });

  // 6. POST to /scan/start — no provider inference -------------------------
  const scanStartUrl = joinEnginePath(orchestratorUrl, "/scan/start");
  try {
    const dispatchBody = {
      scan_id: scan.id,
      user_id: scan.user_id,
      target_model: scan.target_model,
      target_url: targetUrl,
      target_api_key: targetApiKey,
      api_key: targetApiKey,
      intensity: scan.intensity ?? "standard",
      surface_kind: scan.surface_kind ?? "llm",
      target_type: scan.surface_kind ?? "llm",
      asset_value_usd:
        scan.asset_value_usd != null && scan.asset_value_usd > 0
          ? scan.asset_value_usd
          : 50000,
      ownership_verified: sovereign,
      is_ghost_active: isGhostActive,
    };
    const resp = await fetch(scanStartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...engineAuthHeaders(),
      },
      body: JSON.stringify(dispatchBody),
      signal: AbortSignal.timeout(ENGINE_HANDSHAKE_TIMEOUT_MS),
    });

    const text = await resp.text().catch(() => "");

    if (!resp.ok) {
      await markFailure(admin, scanId, {
        message: `Orchestrator returned HTTP ${resp.status}`,
        httpStatus: resp.status,
        rawBody: text,
      });
      return;
    }

    const json = (text ? JSON.parse(text) : {}) as {
      accepted?: boolean;
      scan_id?: string;
      intensity?: string;
    };

    await emit(admin, scanId, {
      type: "info",
      severity: "info",
      payload: {
        message: "Orchestrator accepted scan",
        accepted: json.accepted ?? false,
        intensity: json.intensity ?? scan.intensity ?? "standard",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[runner] dispatch failed:", {
      url: scanStartUrl,
      scan_id: scanId,
      message,
    });
    await markFailure(admin, scanId, {
      message: `Failed to dispatch to orchestrator: ${message}`,
      rawBody: message,
    });
    return;
  }

  // From here on, Railway owns the lifecycle. It writes scan_logs +
  // updates scans.progress_pct/status as the Brain works through the
  // attack catalogue. Vercel's job is done.
}

/* -------------------------------------------------------------------------- */
/* Supabase helpers                                                           */
/* -------------------------------------------------------------------------- */

type FailureDetail = string | {
  message: string;
  httpStatus?: number;
  rawBody?: string;
};

async function emit(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  ev: RunnerEvent,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("scan_logs").insert({
    scan_id: scanId,
    type: ev.type,
    severity: ev.severity ?? "info",
    attack_name: ev.attack_name ?? null,
    payload: ev.payload != null ? stringifyPayloadNumerics(ev.payload) : null,
  });
  if (error) {
    console.error("[runner] log insert failed:", error.message);
  }
}

async function transitionStatus(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  status: ScanStatus,
  patch: Partial<Database["public"]["Tables"]["scans"]["Update"]> = {},
): Promise<void> {
  const update: Database["public"]["Tables"]["scans"]["Update"] = {
    status,
    ...patch,
  };
  if (status === "probing" && !patch.started_at) {
    update.started_at = new Date().toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("scans")
    .update(update)
    .eq("id", scanId);
  if (error) {
    console.error("[runner] status transition failed:", error.message);
  }
}

async function markFailure(
  admin: ReturnType<typeof createAdminSupabase>,
  scanId: string,
  detail: FailureDetail,
): Promise<void> {
  const message = typeof detail === "string" ? detail : detail.message;
  const httpStatus = typeof detail === "string" ? undefined : detail.httpStatus;
  const rawBody = typeof detail === "string" ? detail : (detail.rawBody ?? detail.message);

  await emit(admin, scanId, {
    type: "error",
    severity: "high",
    attack_name: "dispatch_error",
    payload: {
      message,
      http_status: httpStatus,
      raw_response_body: rawBody,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("scans")
    .update({
      status: "failed",
      progress_pct: 100,
      completed_at: new Date().toISOString(),
      failure_reason: rawBody,
    })
    .eq("id", scanId);
}
