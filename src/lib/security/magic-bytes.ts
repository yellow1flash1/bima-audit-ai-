export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type AllowedMime = "application/pdf" | "image/jpeg" | "image/png";

export type SniffResult =
  | { ok: true; mime: AllowedMime }
  | { ok: false; reason: "too_large" | "empty" | "unsupported_type" | "embedded_script" };

/**
 * Decide the file type from its header bytes, never from the extension or the
 * client-supplied Content-Type. SVG, HTML, ZIP/Office and executables are refused.
 */
export function sniff(bytes: Uint8Array): SniffResult {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);

  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    // %PDF- : refuse PDFs carrying JavaScript or auto-launch actions
    const head = latin1(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
    if (/\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(head)) return { ok: false, reason: "embedded_script" };
    return { ok: true, mime: "application/pdf" };
  }
  if (starts([0xff, 0xd8, 0xff])) return { ok: true, mime: "image/jpeg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, mime: "image/png" };

  return { ok: false, reason: "unsupported_type" };
}

function latin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
}
