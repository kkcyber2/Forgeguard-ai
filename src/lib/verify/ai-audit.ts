/**
 * Identity document AI audit — vision perception + DeepSeek-R1 via OpenRouter.
 * Shared by /api/verify/ai-audit, runAiAudit server action, and admin triage.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";
import { resolveAppUrl } from "@/lib/app-url";

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
const FUZZY_MATCH_THRESHOLD = 0.8;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length]!;
}

function nameTokens(name: string): string[] {
  return normalizeName(name).split(" ").filter((t) => t.length > 1);
}

/** 0–1 similarity; ≥0.8 counts as a fuzzy identity match. */
export function fuzzyNameSimilarity(profileName: string, extractedName: string): number {
  const p = normalizeName(profileName);
  const e = normalizeName(extractedName);
  if (!p || !e) return 0;
  if (p === e) return 1;

  const maxLen = Math.max(p.length, e.length);
  const editSim = maxLen > 0 ? 1 - levenshtein(p, e) / maxLen : 0;

  const pTokens = nameTokens(profileName);
  const eTokens = nameTokens(extractedName);
  if (pTokens.length === 0 || eTokens.length === 0) return editSim;

  const required =
    pTokens.length >= 2
      ? [pTokens[0]!, pTokens[pTokens.length - 1]!]
      : pTokens;

  const tokenMatches = required.filter((t) =>
    eTokens.some((et) => {
      if (et === t) return true;
      const maxT = Math.max(t.length, et.length);
      return maxT > 0 && (1 - levenshtein(t, et) / maxT) >= 0.85;
    }),
  ).length;

  const tokenSim = tokenMatches / required.length;
  return Math.max(editSim, tokenSim);
}

export function fuzzyNamesMatch(profileName: string, extractedName: string): boolean {
  return fuzzyNameSimilarity(profileName, extractedName) >= FUZZY_MATCH_THRESHOLD;
}

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
  const tokenMatch = tokens.length > 0 && tokens.every((t) => doc.includes(t));

  const extractedGuess =
    input.documentText.match(/extracted_name="([^"]+)"/i)?.[1] ??
    input.documentText.match(/name[:\s]+([a-z][a-z\s.'-]{2,60})/i)?.[1]?.trim() ??
    "";

  const fuzzyMatch =
    extractedGuess.length > 0 &&
    fuzzyNamesMatch(input.profileFullName, extractedGuess);

  const matched = tokenMatch || fuzzyMatch;
  const score = matched ? (fuzzyMatch ? 82 : 72) : 35;
  return {
    extracted_name: extractedGuess || input.profileFullName,
    name_match: matched,
    confidence_score: score,
    audit_notes: matched
      ? fuzzyMatch
        ? "Heuristic fuzzy match: extracted name aligns with profile."
        : "Heuristic: all profile name tokens found in document text."
      : "Heuristic: name tokens not fully present in document.",
    mode: "heuristic",
  };
}

function buildPrompt(input: IdentityAuditInput): string {
  return `You are an identity verification auditor for a security research platform.

Extract the legal full name from the identity document text below.
Perform a FUZZY match between the extracted ID name and the profile name:
- Ignore capitalization, punctuation, and accent marks
- Allow minor OCR spelling variations (1–2 character typos per name part)
- Missing middle names, initials, or suffixes on either side still count as a match
- If the names are ≥80% similar, set name_match to true and confidence_score ≥ 85

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
3. Fuzzy-compare extracted name vs profile — ignore case, allow minor typos and missing middle names; ≥80% similar is a match.

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
        "HTTP-Referer": resolveAppUrl(),
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
      const bodySnippet = (await response.text().catch(() => "")).slice(0, 500);
      console.error(
        "[verify:ai-audit] Vision HTTP",
        response.status,
        bodySnippet || "<empty body>",
      );
      return {
        documentText:
          `[IMAGE] profile=${profileFullName}. Vision HTTP ${response.status} — fallback metadata.`,
        failure_reason: `Gemini vision rejected request (HTTP ${response.status}): ${bodySnippet.slice(0, 200) || "no body"}`,
      };
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    console.error(
      "[verify:ai-audit] Vision RAW JSON:",
      JSON.stringify(completion),
    );
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
  engine_raw?: unknown;
}> {
  let documentText = input.documentTextOverride?.trim() ?? "";
  let perceptionMode: IdentityAuditResult["mode"] = "deepseek-r1";
  let visionProviderError: string | undefined;

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
      visionProviderError = vision.failure_reason;
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

  const auditRun = await runIdentityAudit({
    documentText,
    profileFullName: input.profileFullName,
    profileEmail: input.profileEmail,
  });
  const result = auditRun.result;

  if (perceptionMode === "vision+deepseek-r1" && result.mode === "deepseek-r1") {
    result.mode = "vision+deepseek-r1";
  }

  return {
    result,
    failure_reason: auditRun.providerError ?? visionProviderError,
    engine_raw: auditRun.engineRaw,
  };
}

export async function runIdentityAudit(
  input: IdentityAuditInput,
): Promise<{
  result: IdentityAuditResult;
  providerError?: string;
  engineRaw?: unknown;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      result: heuristicIdentityAudit(input),
      providerError: "OPENROUTER_API_KEY not configured — heuristic audit only.",
    };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": resolveAppUrl(),
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

    if (!response.ok) {
      const bodySnippet = (await response.text().catch(() => "")).slice(0, 500);
      const providerError = `DeepSeek-R1 rejected request (HTTP ${response.status}): ${bodySnippet.slice(0, 200) || "no body"}`;
      console.error("[verify:ai-audit] DeepSeek-R1 HTTP", response.status, bodySnippet);
      return {
        result: heuristicIdentityAudit(input),
        providerError,
      };
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    console.error(
      "[verify:ai-audit] DeepSeek-R1 RAW JSON:",
      JSON.stringify(completion),
    );
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<IdentityAuditResult>;
    const extractedName = (parsed.extracted_name ?? "").trim();

    const profileNorm = normalizeName(input.profileFullName);
    const extractedNorm = normalizeName(extractedName);
    const fuzzySim = fuzzyNameSimilarity(input.profileFullName, extractedName);
    const fuzzyMatch = fuzzySim >= FUZZY_MATCH_THRESHOLD;

    const nameMatch =
      parsed.name_match === true ||
      fuzzyMatch ||
      (profileNorm.length > 0 &&
        extractedNorm.length > 0 &&
        (profileNorm === extractedNorm ||
          profileNorm.split(" ").every((t) => extractedNorm.includes(t))));

    if (!nameMatch && extractedName) {
      console.warn("[verify:ai-audit] Name mismatch:", {
        extractedName,
        profileName: input.profileFullName,
        fuzzySimilarity: Math.round(fuzzySim * 100),
      });
    }

    const confidence = Math.min(
      100,
      Math.max(
        0,
        Number(parsed.confidence_score) ||
          (nameMatch ? (fuzzyMatch ? 88 : 85) : 40),
      ),
    );

    return {
      result: {
        extracted_name: extractedName || input.profileFullName,
        name_match: nameMatch,
        confidence_score: nameMatch && fuzzyMatch && confidence < 80 ? 85 : confidence,
        audit_notes:
          parsed.audit_notes ??
          (fuzzyMatch
            ? "DeepSeek-R1 fuzzy identity match (≥80% similar)."
            : "DeepSeek-R1 identity audit complete."),
        mode: "deepseek-r1",
      },
      engineRaw: completion,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify:ai-audit] DeepSeek-R1 request failed:", msg);
    return {
      result: heuristicIdentityAudit(input),
      providerError: `DeepSeek-R1 request failed: ${msg}`,
    };
  }
}
