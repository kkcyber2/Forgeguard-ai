/** Shape stored in profiles.identity_raw_ocr_data */

export interface IdentityRawOcrData {
  image_path: string;
  raw_ocr_text: string;
  mime_type: string;
  captured_at: string;
}

export function buildIdentityRawOcrData(opts: {
  imagePath: string;
  rawOcrText: string;
  mimeType: string;
}): IdentityRawOcrData {
  return {
    image_path: opts.imagePath,
    raw_ocr_text: opts.rawOcrText.slice(0, 8000),
    mime_type: opts.mimeType,
    captured_at: new Date().toISOString(),
  };
}
