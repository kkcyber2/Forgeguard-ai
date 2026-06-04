import "server-only";

import {
  resolveEngineAuthToken,
  resolveEngineBaseUrl,
  engineAuthHeaders,
  resolveScanDispatchKey,
  maskKeyPrefix,
  ENGINE_HANDSHAKE_TIMEOUT_MS,
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
 *   3. Normalize the target URL (strip `/v1/chat/completions` etc — the
 *      OpenAI-compatible client appends its own paths).
 *   4. POST to ${AGATHON_ORCHESTRATOR_URL}/scan/start with bearer auth.
 *   5. The orchestrator emits to scan_logs over Postgres + WebSocket.
 *      We just need to mark the scan as "probing" and return.
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
    .select("email")
    .eq("id", userId)
    .maybeSingle()) as { data: { email: string | null } | null };
  const sovereign = isSovereignOperator(profile?.email);

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

  // 3. Normalize the target URL ------------------------------------------
  // Users often paste the full endpoint (e.g. ".../v1/chat/completions").
  // The OpenAI-compatible client on Railway appends its own path, so we
  // need the base URL only. Strip common trailing paths defensively.
  const normalizedUrl = normalizeTargetUrl(scan.target_url);

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
  await transitionStatus(admin, scanId, "probing", { progress_pct: 1 });
  await emit(admin, scanId, {
    type: "info",
    severity: "info",
    payload: {
      message: "Dispatching to Agathon orchestrator on Railway",
      target_model: scan.target_model,
      target_url: normalizedUrl,
      intensity: scan.intensity ?? "standard",
    },
  });

  // 6. Validate target key + POST to /scan/start ---------------------------
  let dispatchKey: ReturnType<typeof resolveScanDispatchKey>;
  try {
    dispatchKey = resolveScanDispatchKey({
      userApiKey: apiKey,
      targetUrl: normalizedUrl,
      targetModel: scan.target_model,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markFailure(admin, scanId, msg);
    return;
  }

  console.error("[runner] dispatch key resolved:", {
    scan_id: scanId,
    target_provider: dispatchKey.targetProvider,
    key_mask: maskKeyPrefix(dispatchKey.apiKey),
  });

  try {
    const resp = await fetch(`${orchestratorUrl}/scan/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...engineAuthHeaders(),
      },
      body: JSON.stringify({
        scan_id: scan.id,
        user_id: scan.user_id,
        target_model: scan.target_model,
        target_url: normalizedUrl,
        intensity: scan.intensity ?? "standard",
        surface_kind: scan.surface_kind ?? "llm",
        asset_value_usd:
          scan.asset_value_usd != null && scan.asset_value_usd > 0
            ? scan.asset_value_usd
            : 50000,
        api_key: dispatchKey.apiKey,
        ownership_verified: sovereign,
        target_provider: dispatchKey.targetProvider,
      }),
      // Don't hold the connection open — Railway acknowledges fast.
      signal: AbortSignal.timeout(ENGINE_HANDSHAKE_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "<no body>");
      throw new Error(
        `Railway returned ${resp.status} ${resp.statusText}: ${text.slice(0, 400)}`,
      );
    }

    const json = (await resp.json().catch(() => ({}))) as {
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
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[runner] dispatch failed:", {
      url: `${orchestratorUrl}/scan/start`,
      scan_id: scanId,
      message,
      stack,
      err,
    });
    await markFailure(
      admin,
      scanId,
      `Failed to dispatch to orchestrator: ${(err as Error).message}`,
    );
    return;
  }

  // From here on, Railway owns the lifecycle. It writes scan_logs +
  // updates scans.progress_pct/status as the Brain works through the
  // attack catalogue. Vercel's job is done.
}

/* -------------------------------------------------------------------------- */
/* URL normalization                                                          */
/* -------------------------------------------------------------------------- */

function normalizeTargetUrl(raw: string): string {
  let url = raw.trim();
  // Drop trailing slash.
  while (url.endsWith("/")) url = url.slice(0, -1);
  // Strip the conventional OpenAI-compatible chat completions path.
  url = url.replace(/\/v1\/chat\/completions$/i, "");
  url = url.replace(/\/v1\/completions$/i, "");
  url = url.replace(/\/v1\/embeddings$/i, "");
  // Strip a bare /v1 suffix — the client appends /v1 itself.
  url = url.replace(/\/v1$/i, "");
  return url;
}

/* -------------------------------------------------------------------------- */
/* Supabase helpers                                                           */
/* -------------------------------------------------------------------------- */

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
  message: string,
): Promise<void> {
  await emit(admin, scanId, {
    type: "error",
    severity: "high",
    payload: { message },
  });
  await transitionStatus(admin, scanId, "failed", {
    progress_pct: 100,
    completed_at: new Date().toISOString(),
  });
}
