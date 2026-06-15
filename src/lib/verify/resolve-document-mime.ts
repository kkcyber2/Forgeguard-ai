const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

function extFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.(pdf|png|jpe?g|webp)$/);
  if (!m) return null;
  const ext = m[1];
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function sniffDocumentMime(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function resolveDocumentMime(
  file: File,
  buffer: Buffer,
): string | null {
  const fromType = file.type?.trim().toLowerCase();
  if (fromType && (ALLOWED_DOC_MIMES as readonly string[]).includes(fromType)) {
    return fromType;
  }
  const fromExt = extFromName(file.name);
  if (fromExt) return fromExt;
  return sniffDocumentMime(buffer);
}
