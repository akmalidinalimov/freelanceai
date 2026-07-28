/**
 * Client-side image normalization. Re-encodes ANY image the browser can decode
 * (iPhone HEIC on Safari, GIF, BMP, TIFF…) into webp, downscaling oversized phone
 * photos on the way. This is what lets the upload inputs accept `image/*` while
 * storage keeps a small, predictable allowlist.
 *
 * Returns null when the browser cannot decode the file at all — callers should show
 * a "try a JPG" message rather than pushing an unreadable blob to storage.
 */

/** Formats storage accepts as-is; small files in these skip re-encoding entirely. */
export const NATIVE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function toWebpBlob(file: File, maxEdge = 1600): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = url;
    });
    if (!img || !img.naturalWidth) return null;
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const k = long > maxEdge ? maxEdge / long : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
  } finally {
    URL.revokeObjectURL(url);
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
  // Undecodable, but storage would accept the original format → send it unchanged.
  return NATIVE_IMAGE_TYPES.includes(file.type) ? { blob: file, contentType: file.type } : null;
}
