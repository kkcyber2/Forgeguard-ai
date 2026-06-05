/**
 * Agathon engine identity OCR — POST /identity/ocr with internal scan token.
 */

import { engineAuthHeaders, resolveEngineBaseUrl } from "@/lib/agathon-config";
import { stripNonAscii } from "@/lib/verify/text-transport";

const OCR_TIMEOUT_MS = 20_000;

export interface EngineOcrResult {
  ocr_text: string;
  extracted_name: string;
  audit_notes: string;
}

export async function callEngineIdentityOcr(input: {
  imageBase64: string;
  mimeType: string;
  profileFullName: string;
  userId?: string;
  isGhostActive?: boolean;
}): Promise<{ result?: EngineOcrResult; error?: string; timedOut?: boolean }> {
  const base = resolveEngineBaseUrl();
  if (!base) {
    return { error: "PYTHON_ENGINE_URL not configured." };
  }

  const headers = engineAuthHeaders();
  if (!headers) {
    return { error: "INTERNAL_SCAN_TOKEN not configured." };
  }

  const url = `${base.replace(/\/+$/, "")}/identity/ocr`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_base64: input.imageBase64,
        mime_type: input.mimeType,
        profile_full_name: input.profileFullName,
        user_id: input.userId ?? "",
        is_ghost_active: Boolean(input.isGhostActive),
      }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      cache: "no-store",
    });

    const bodyText = (await resp.text().catch(() => "")).slice(0, 2000);
    console.error(
      "[identity:engine-ocr] status=%s body=%s",
      resp.status,
      stripNonAscii(bodyText).slice(0, 500),
    );

    if (!resp.ok) {
      return {
        error: `Engine OCR HTTP ${resp.status}: ${stripNonAscii(bodyText).slice(0, 200)}`,
      };
    }

    const data = JSON.parse(bodyText || "{}") as {
      ok?: boolean;
      ocr_text?: string;
      extracted_name?: string;
      audit_notes?: string;
    };

    return {
      result: {
        ocr_text: stripNonAscii(data.ocr_text ?? ""),
        extracted_name: stripNonAscii(data.extracted_name ?? ""),
        audit_notes: stripNonAscii(data.audit_notes ?? ""),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut =
      err instanceof Error &&
      (err.name === "TimeoutError" || msg.toLowerCase().includes("timeout"));
    console.error("[identity:engine-ocr] failed:", msg);
    return { error: msg, timedOut };
  }
}
