/**
 * Strip non-ASCII characters from model/engine OCR output (ByteString-safe transport).
 */
export function stripNonAscii(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, "");
}
