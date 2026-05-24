/**
 * Simulated OCR / document text extraction for admin identity triage.
 * Downloads from verification-docs bucket when possible; falls back to metadata.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";

export async function extractIdentityDocumentText(
  documentPath: string | null,
  profileFullName: string,
  profileEmail: string,
): Promise<string> {
  if (!documentPath) {
    return `[NO_DOCUMENT] profile=${profileFullName} email=${profileEmail}`;
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from("verification-docs")
    .download(documentPath);

  if (error || !data) {
    return (
      `[DOCUMENT_REF] path=${documentPath} filename=${documentPath.split("/").pop()} ` +
      `profile_name=${profileFullName} email=${profileEmail}. ` +
      `Storage fetch unavailable — auditor uses path + profile correlation.`
    );
  }

  const ext = documentPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    const buf = await data.arrayBuffer();
    const sample = Buffer.from(buf).toString("latin1").slice(0, 4000);
    const printable = sample.replace(/[^\x20-\x7E\n\r]/g, " ").slice(0, 2000);
    return (
      `[PDF_UPLOAD] path=${documentPath} size=${buf.byteLength} ` +
      `profile=${profileFullName} extracted_sample=${printable || "binary_pdf"}`
    );
  }

  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return (
      `[IMAGE_UPLOAD] path=${documentPath} type=image/${ext} ` +
      `profile=${profileFullName} email=${profileEmail}. ` +
      `Simulated OCR: legal name candidate "${profileFullName}" from profile cross-check pipeline.`
    );
  }

  const text = await data.text().catch(() => "");
  return text.slice(0, 8000) || `[BINARY] path=${documentPath} profile=${profileFullName}`;
}
