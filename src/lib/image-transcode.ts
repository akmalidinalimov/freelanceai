import "server-only";
import sharp from "sharp";

/**
 * Server-side rescue for images the browser cannot decode.
 *
 * HEIC is the case that matters. Every iPhone and many Samsungs shoot it by default, and no
 * Chromium-based browser can decode it — not on Android, not on the desktop. Safari can, so this
 * is only ever reached by the clients that genuinely cannot cope. Doing it here rather than
 * shipping a WASM decoder keeps ~1.5MB out of everyone's bundle, adds no third-party dependency to
 * audit, and puts the decode where there is real memory instead of on the phone that just failed.
 *
 * libvips also gives us TIFF and GIF for free, so "the browser could not read it" stops being a
 * dead end for anything a camera or scanner is likely to produce.
 */

/** The longest edge we hand back. Callers render to a few hundred pixels at most. */
const MAX_EDGE = 2048;

/**
 * Refuse absurd pixel counts before allocating anything. A small file can decode to an enormous
 * bitmap — a decompression bomb — and libvips will happily try. 100MP comfortably clears a 200MP
 * phone photo's usable range while capping what one request can cost us.
 */
const MAX_INPUT_PIXELS = 100_000_000;

export type TranscodeResult =
  | { ok: true; body: Buffer; contentType: "image/webp"; width: number; height: number }
  | { ok: false; reason: "unsupported" | "too_large" | "failed" };

/**
 * True when this build can decode a real phone HEIC — i.e. HEVC-coded HEIF.
 *
 * Checking `sharp.format.heif.input.buffer` is NOT enough and reports a false positive: the same
 * libvips loader serves AVIF and HEIC, so that flag is true on a build that only understands AVIF.
 * Measured on the installed binary — `fileSuffix` is exactly [".avif"], and asking it to write
 * HEVC returns "heifsave: Unsupported compression". sharp's prebuilt libvips deliberately omits
 * HEVC because of the patent licensing, so this is the normal case, not a broken install.
 *
 * The distinction is the whole point: every iPhone and many Samsungs shoot HEVC-HEIC, so a check
 * that says yes here while the decode fails is worse than no check at all — it turns an honest
 * "we cannot read this" into a silent failure.
 */
export function canDecodeHeif(): boolean {
  try {
    const suffixes = sharp.format.heif?.input?.fileSuffix ?? [];
    return suffixes.some((s) => s.toLowerCase() === ".heic" || s.toLowerCase() === ".heif");
  } catch {
    return false;
  }
}

/** True when this build can decode AVIF, which the same loader handles and which browsers mostly do too. */
export function canDecodeAvif(): boolean {
  try {
    return (sharp.format.heif?.input?.fileSuffix ?? []).some((s) => s.toLowerCase() === ".avif");
  } catch {
    return false;
  }
}

/** Formats we are willing to rescue. Anything else is a job for the client's own decoder. */
export function canTranscode(contentType: string, sniffedHeic: boolean): boolean {
  if (sniffedHeic) return canDecodeHeif();
  return ["image/tiff", "image/gif", "image/bmp", "image/jpeg", "image/png", "image/webp"].includes(
    contentType
  );
}

/**
 * Decode whatever this is and return a bounded webp.
 *
 * `rotate()` with no argument applies the EXIF orientation and drops the tag, which is what stops a
 * phone photo arriving sideways. Metadata is not copied forward, so GPS coordinates in a seller's
 * portfolio photo do not travel to public storage.
 */
export async function transcodeToWebp(input: Buffer): Promise<TranscodeResult> {
  try {
    const img = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: "unsupported" };

    const long = Math.max(meta.width, meta.height);
    const pipeline = long > MAX_EDGE ? img.resize({ width: MAX_EDGE, withoutEnlargement: true, fit: "inside" }) : img;
    const out = await pipeline.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      body: out.data,
      contentType: "image/webp",
      width: out.info.width,
      height: out.info.height,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // libvips' exact wording, confirmed against the installed build rather than guessed:
    // "Input image exceeds pixel limit". Separated from the generic failure so the caller can say
    // "too big" instead of sending someone hunting the wrong problem.
    if (/exceeds pixel limit|limitInputPixels|too large/i.test(msg)) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: false, reason: "failed" };
  }
}
