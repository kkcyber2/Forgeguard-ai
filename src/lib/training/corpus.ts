import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redactSecrets } from "@/lib/security/redact-secrets";

export const TRAINING_CORPUS_BUCKET = "training-corpus-private";

export type TrainingCorpusEventType =
  | "scan_completed"
  | "finding"
  | "remediation"
  | "attack_path"
  | "breach_log";

export interface TrainingCorpusEventInput {
  scanId: string;
  userId: string;
  eventType: TrainingCorpusEventType;
  payload: Record<string, unknown>;
  exportable?: boolean;
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      out[key] = redactSecrets(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string"
          ? redactSecrets(item)
          : item && typeof item === "object"
            ? redactPayload(item as Record<string, unknown>)
            : item,
      );
    } else if (value && typeof value === "object") {
      out[key] = redactPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Append a redacted training corpus row (respects user opt-out via exportable flag). */
export async function appendTrainingCorpusEvent(
  admin: SupabaseClient,
  input: TrainingCorpusEventInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from("profiles")
    .select("training_corpus_opt_out")
    .eq("id", input.userId)
    .maybeSingle();

  const optedOut = Boolean(profile?.training_corpus_opt_out);
  const payload = redactPayload(input.payload);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("training_corpus_events").insert({
    scan_id: input.scanId,
    user_id: input.userId,
    event_type: input.eventType,
    payload_json: payload,
    redacted: true,
    exportable: optedOut ? false : (input.exportable ?? true),
  });

  if (error) {
    console.warn("[training-corpus] append failed:", error.message);
  }
}

/** Build corpus rows from a sealed scan report payload. */
export async function ingestScanCompletedCorpus(
  admin: SupabaseClient,
  params: {
    scanId: string;
    userId: string;
    findings: unknown[];
    attackPath?: unknown[];
    riskLabel?: string;
    attacksRun?: number;
  },
): Promise<void> {
  await appendTrainingCorpusEvent(admin, {
    scanId: params.scanId,
    userId: params.userId,
    eventType: "scan_completed",
    payload: {
      risk_label: params.riskLabel ?? "NONE",
      attacks_run: params.attacksRun ?? 0,
      finding_count: params.findings.length,
    },
  });

  for (const finding of params.findings) {
    if (!finding || typeof finding !== "object") continue;
    const f = finding as Record<string, unknown>;
    await appendTrainingCorpusEvent(admin, {
      scanId: params.scanId,
      userId: params.userId,
      eventType: "finding",
      payload: {
        title: f.title,
        severity: f.severity,
        owasp_llm: f.owasp_llm ?? f.owasp,
        description: f.description,
        reproduction_steps: f.reproduction_steps,
        remediation: f.remediation,
      },
    });
  }

  if (params.attackPath?.length) {
    await appendTrainingCorpusEvent(admin, {
      scanId: params.scanId,
      userId: params.userId,
      eventType: "attack_path",
      payload: { steps: params.attackPath },
    });
  }
}

/** Export exportable corpus events as JSONL to private storage; returns storage path. */
export async function exportTrainingCorpusToStorage(
  admin: SupabaseClient,
): Promise<{ ok: true; path: string; rowCount: number } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (admin as any)
    .from("training_corpus_events")
    .select("id, scan_id, user_id, event_type, payload_json, created_at")
    .eq("exportable", true)
    .order("created_at", { ascending: true })
    .limit(50_000);

  if (error) {
    return { ok: false, error: error.message };
  }

  const lines = (events ?? []).map((row: {
    id: string;
    scan_id: string | null;
    user_id: string;
    event_type: string;
    payload_json: unknown;
    created_at: string;
  }) =>
    JSON.stringify({
      id: row.id,
      scan_id: row.scan_id,
      user_id: row.user_id,
      event_type: row.event_type,
      payload: row.payload_json,
      created_at: row.created_at,
    }),
  );
  const body = lines.length ? `${lines.join("\n")}\n` : "";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `exports/corpus-${stamp}.jsonl`;

  const { error: uploadErr } = await admin.storage
    .from(TRAINING_CORPUS_BUCKET)
    .upload(path, Buffer.from(body, "utf8"), {
      contentType: "application/x-ndjson",
      upsert: false,
    });

  if (uploadErr) {
    return { ok: false, error: uploadErr.message };
  }

  return { ok: true, path, rowCount: lines.length };
}

/** Signed download URL for admin (1h). */
export async function getTrainingCorpusExportUrl(
  admin: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(TRAINING_CORPUS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
