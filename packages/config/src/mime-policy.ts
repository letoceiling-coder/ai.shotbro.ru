const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "text/plain",
]);

export function isAllowedMime(mime: string): boolean {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED.has(base);
}

/** Sniff MIME from magic bytes; returns null if unknown. */
export function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
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
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }
  if (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "ID3") {
    return "audio/mpeg";
  }
  return null;
}

export function mimeMatchesDeclared(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  const d = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  return d === sniffed;
}
