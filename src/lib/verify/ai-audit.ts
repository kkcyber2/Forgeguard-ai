/**
 * Identity document AI audit — vision perception + DeepSeek-R1 via OpenRouter.
 * Shared by /api/verify/ai-audit, runAiAudit server action, and admin triage.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";

export interface IdentityAuditInput {
  documentText: string;
  profileFullName: string;
  profileEmail: string;
}

export interface IdentityAuditResult {
  extracted_name: string;
  name_match: boolean;
  confidence_score: number;
  audit_notes: string;
  mode: "deepseek-r1" | "heuristic" | "vision+deepseek-r1";
}

export interface StoredDocumentInput {
  documentPath: string;
  profileFullName: string;
  profileEmail: string;
  documentTextOverride?: string;
}

const MAX_IMAGE_BYTES = 900_000;
const VISION_MODEL = "google/gemini-flash-1.5";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function heuristicIdentityAudit(input: IdentityAuditInput): IdentityAuditResult {
  const profile = normalizeName(input.profileFullName || "");
  const doc = input.documentText.toLowerCase();
  const tokens = profile.split(" ").filter((t) => t.length > 1);
  const matched = tokens.length > 0 && tokens.every((t) => doc.includes(t));
  const score = matched ? 72 : 35;
  return {
    extracted_name: input.profileFullName,
    name_match: matched,
    confidence_score: score,
    audit_notes: matched
      ? "Heuristic: all profile name tokens found in document text."
      : "Heuristic: name tokens not fully present in document.",
    mode: "heuristic",
  };
}

function buildPrompt(input: IdentityAuditInput): string {
  return `You are an identity verification auditor for a security research platform.

Extract the legal full name from the identity document text below.
Compare it to the registered profile name.

Profile name: "${input.profileFullName}"
Profile email: "${input.profileEmail}"

Document text (OCR / upload):
"""
${input.documentText.slice(0, 8000)}
"""

Respond ONLY with valid JSON:
{
  "extracted_name": string,
  "name_match": boolean,
  "confidence_score": number (0-100),
  "audit_notes": string (one sentence)
}`;
}

function mimeFromPath(documentPath: string): string {
  const ext = documentPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function deriveFailureReason(
  result: IdentityAuditResult,
  passed: boolean,
): string | undefined {
  if (passed) return undefined;
  const notes = result.audit_notes.toLowerCase();
  if (notes.includes("blur")) return "Image blurry — hold steady and retake.";
  if (notes.includes("unreadable") || notes.includes("illegible")) {
    return "Document unreadable — improve lighting and retry.";
  }
  if (!result.name_match || notes.includes("mismatch")) {
    return "Name mismatch — your profile name must match your ID.";
  }
  return result.audit_notes || "Identity audit did not pass.";
}

async function downloadVerificationDocument(
  documentPath: string,
): Promise<{ buffer: Buffer; mimeType: string } | { error: string }> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from("verification-docs")
    .download(documentPath);

  if (error || !data) {
    console.error("[verify:ai-audit] storage download:", error?.message ?? "no data");
    return { error: "Could not load identity document from secure storage." };
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, mimeType: mimeFromPath(documentPath) };
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function documentBufferToText(
  buffer: Buffer,
  mimeType: string,
  documentPath: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    const sample = buffer.toString("latin1").slice(0, 4000);
    const printable = sample.replace(/[^\x20-\x7E\n\r]/g, " ").slice(0, 2000);
    return (
      `[PDF] path=${documentPath} size=${buffer.byteLength} ` +
      `extracted_sample=${printable || "binary_pdf"}`
    );
  }

  if (mimeType.startsWith("text/") || documentPath.endsWith(".txt")) {
    return buffer.toString("utf8").slice(0, 8000);
  }

  return `[BINARY] path=${documentPath} size=${buffer.byteLength}`;
}

interface VisionPerception {
  documentText: string;
  blocked?: boolean;
  failure_reason?: string;
  audit_notes?: string;
}

async function runVisionPerception(
  buffer: Buffer,
  mimeType: string,
  profileFullName: string,
  profileEmail: string,
): Promise<VisionPerception> {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return {
      documentText: "",
      blocked: true,
      failure_reason: "Image too large — retake closer or use a compressed photo.",
      audit_notes: "Image exceeds size limit for AI perception.",
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      documentText:
        `[IMAGE] profile=${profileFullName} email=${profileEmail}. ` +
        "Vision unavailable — heuristic name token check only.",
    };
  }

  const dataUrl = bufferToDataUrl(buffer, mimeType);
  const prompt = `You are an identity document perception engine for a security platform.

Analyze this government ID or identity document image.

Profile name to verify against: "${profileFullName}"
Profile email: "${profileEmail}"

Tasks:
1. Read the legal full name printed on the document (OCR).
2. Detect if the image is too blurry, dark, or cropped to read.
3. Note any obvious name mismatch vs the profile name.

Respond ONLY with valid JSON:
{
  "extracted_name": string,
  "document_readable": boolean,
  "blur_detected": boolean,
  "ocr_text": string (all readable text from the ID, max 2000 chars),
  "audit_notes": string (one sentence — e.g. "Name mismatch", "Image blurry", or "Clear ID read")
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai",
        "X-Title": "ForgeGuard AI — Identity Perception",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      console.error("[verify:ai-audit] vision HTTP", response.status);
      return {
        documentText:
          `[IMAGE] profile=${profileFullName}. Vision HTTP ${response.status} — fallback metadata.`,
      };
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      extracted_name?: string;
      document_readable?: boolean;
      blur_detected?: boolean;
      ocr_text?: string;
      audit_notes?: string;
    };

    if (parsed.blur_detected || parsed.document_readable === false) {
      return {
        documentText: parsed.ocr_text ?? "",
        blocked: true,
        failure_reason: "Image blurry — hold steady and retake.",
        audit_notes: parsed.audit_notes ?? "Image too blurry to verify.",
      };
    }

    const ocr = (parsed.ocr_text ?? "").trim();
    const extracted = (parsed.extracted_name ?? "").trim();
    const documentText =
      ocr.length >= 20
        ? ocr
        : `[ID OCR] extracted_name="${extracted}" profile="${profileFullName}" notes=${parsed.audit_notes ?? ""}`;

    return { documentText, audit_notes: parsed.audit_notes };
  } catch (err) {
    console.error("[verify:ai-audit] vision error:", err);
    return {
      documentText:
        `[IMAGE] profile=${profileFullName}. Vision error — fallback metadata.`,
    };
  }
}

function blockedAuditResult(
  notes: string,
  failureReason: string,
): IdentityAuditResult {
  return {
    extracted_name: "",
    name_match: false,
    confidence_score: 25,
    audit_notes: notes,
    mode: "vision+deepseek-r1",
  };
}

export async function runIdentityAuditFromStorage(
  input: StoredDocumentInput,
): Promise<{
  result?: IdentityAuditResult;
  error?: string;
  failure_reason?: string;
}> {
  let documentText = input.documentTextOverride?.trim() ?? "";
  let perceptionMode: IdentityAuditResult["mode"] = "deepseek-r1";

  if (!documentText) {
    const downloaded = await downloadVerificationDocument(input.documentPath);
    if ("error" in downloaded) {
      return { error: downloaded.error };
    }

    const { buffer, mimeType } = downloaded;

    if (isImageMime(mimeType)) {
      const vision = await runVisionPerception(
        buffer,
        mimeType,
        input.profileFullName,
        input.profileEmail,
      );

      if (vision.blocked) {
        return {
          result: blockedAuditResult(
            vision.audit_notes ?? vision.failure_reason ?? "Document unreadable.",
            vision.failure_reason ?? "Document unreadable.",
          ),
          failure_reason: vision.failure_reason,
        };
      }

      documentText = vision.documentText;
      perceptionMode = "vision+deepseek-r1";
    } else {
      documentText = await documentBufferToText(buffer, mimeType, input.documentPath);
    }
  }

  if (documentText.length < 10) {
    return {
      error: "Document text too short for audit.",
      failure_reason: "Document unreadable — improve lighting and retry.",
    };
  }

  const result = await runIdentityAudit({
    documentText,
    profileFullName: input.profileFullName,
    profileEmail: input.profileEmail,
  });

  if (perceptionMode === "vision+deepseek-r1" && result.mode === "deepseek-r1") {
    result.mode = "vision+deepseek-r1";
  }

  return { result };
}

export async function runIdentityAudit(
  input: IdentityAuditInput,
): Promise<IdentityAuditResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return heuristicIdentityAudit(input);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeguard.ai",
        "X-Title": "ForgeGuard AI — Identity Auditor",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [{ role: "user", content: buildPrompt(input) }],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) return heuristicIdentityAudit(input);

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<IdentityAuditResult>;

    const profileNorm = normalizeName(input.profileFullName);
    const extractedNorm = normalizeName(parsed.extracted_name ?? "");
    const nameMatch =
      parsed.name_match ??
      (profileNorm.length > 0 &&
        extractedNorm.length > 0 &&
        (profileNorm === extractedNorm ||
          profileNorm.split(" ").every((t) => extractedNorm.includes(t))));

    return {
      extracted_name: parsed.extracted_name ?? input.profileFullName,
      name_match: nameMatch,
      confidence_score: Math.min(
        100,
        Math.max(0, Number(parsed.confidence_score) || (nameMatch ? 85 : 40)),
      ),
      audit_notes: parsed.audit_notes ?? "DeepSeek-R1 identity audit complete.",
      mode: "deepseek-r1",
    };
  } catch {
    return heuristicIdentityAudit(input);
  }
}
