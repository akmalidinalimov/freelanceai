import { decodeImageBounded, isDecodeFailure, transcodeViaServer } from "@/lib/image-decode";

/**
 * Client-side image normalization. Re-encodes ANY image the browser can decode
 * (iPhone HEIC on Safari, GIF, BMP, TIFF…) into webp, downscaling oversized phone
 * photos on the way. This is what lets the upload inputs accept `image/*` while
 * storage keeps a small, predictable allowlist.
 *
 * Decoding is bounded (see image-decode.ts), so an oversized phone photo is downsampled rather
 * than exhausting the device.
 *
 * Returns null when the browser cannot decode the file at all — callers should show
 * a "try a JPG" message rather than pushing an unreadable blob to storage.
 */

/** Formats storage accepts as-is; small files in these skip re-encoding entirely. */
export const NATIVE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function toWebpBlob(file: File, maxEdge = 1600): Promise<Blob | null> {
  // Bounded decode, not `new Image()`. A 108MP phone photo is ~432MB as a full bitmap, which is
  // enough for a mobile WebView to fail outright — and that failure was indistinguishable from an
  // unreadable format, so users were told to try a JPG about a file that already was one.
  const res = await decodeImageBounded(file, maxEdge);
  if (isDecodeFailure(res)) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = res.width;
    canvas.height = res.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(res.source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
  } finally {
    res.close();
  }
}

/**
 * Prepare any picked image for upload: returns the blob to PUT and its content type.
 * Small native-format files pass through untouched; everything else is re-encoded.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; contentType: string } | null> {
  const smallAndNative = NATIVE_IMAGE_TYPES.includes(file.type) && file.size <= 2 * 1024 * 1024;
  if (smallAndNative) return { blob: file, contentType: file.type };

  const webp = await toWebpBlob(file);
  if (webp) return { blob: webp, contentType: "image/webp" };

  // The browser could not read it. Before giving up, let the server try — this is the HEIC path,
  // which no Chromium browser can decode but libvips can. Same rescue the cropper uses, so a
  // banner or portfolio upload is not held to a lower standard than an avatar.
  const converted = await transcodeViaServer(file);
  if (converted) return { blob: converted, contentType: "image/webp" };

  // Undecodable everywhere, but storage would accept the original format → send it unchanged.
  return NATIVE_IMAGE_TYPES.includes(file.type) ? { blob: file, contentType: file.type } : null;
}
