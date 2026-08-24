/**
 * Decode a picked image with a hard ceiling on how big it is allowed to get in memory.
 *
 * The old path was `new Image()` on an object URL, which decodes at FULL resolution. A modern
 * phone camera shoots 50-200MP, and a 108MP photo is ~432MB as a bitmap before anything is drawn —
 * enough for a mobile WebView to simply fail. The failure surfaced as `onerror`, indistinguishable
 * from a genuinely unreadable format, so the user was told "try a JPG or PNG" about a file that
 * already was a JPG.
 *
 * `createImageBitmap` with `resizeWidth`/`resizeHeight` downsamples DURING decode, so the full-size
 * bitmap is never allocated. Nothing is lost: every caller here renders to at most a few hundred
 * pixels, so a 2048px decode is already several times more detail than the output can hold.
 *
 * Reasons are separated because they need different answers. "Too big" is ours to solve and now is.
 * HEIC genuinely cannot be decoded by Chrome or Android WebView at all, so the honest response is
 * to name it and say which setting to change — not to imply the user picked the wrong file.
 */

export type DecodedImage = {
  /** Drawable source, already bounded. Safe to pass to ctx.drawImage. */
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Frees the underlying bitmap. Always call it. */
  close: () => void;
};

export type DecodeFailure = { reason: "heic" | "undecodable" };

export type DecodeResult = DecodedImage | DecodeFailure;

export function isDecodeFailure(r: DecodeResult): r is DecodeFailure {
  return (r as DecodeFailure).reason !== undefined;
}

/**
 * Sniff HEIC/HEIF from the file's own bytes rather than trusting `file.type`.
 *
 * Android's picker frequently reports `image/*` or an empty type for HEIF, and some send
 * `image/jpeg` outright, so the MIME string cannot be believed. The container is ISO-BMFF: bytes
 * 4..8 are "ftyp" and the brand that follows names the codec.
 */
export async function looksLikeHeic(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length < 12) return false;
    const tag = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (tag !== "ftyp") return false;
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
    return ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].includes(brand);
  } catch {
    return false;
  }
}

/** Bounded decode. `maxEdge` caps the longest side; aspect ratio is preserved. */
export async function decodeImageBounded(file: File, maxEdge = 2048): Promise<DecodeResult> {
  if (await looksLikeHeic(file)) return { reason: "heic" };

  // Preferred path: downsample during decode so a huge photo never costs full-size memory.
  if (typeof createImageBitmap === "function") {
    try {
      // Probe orientation cheaply so the ceiling applies to the LONG edge either way. Passing only
      // resizeWidth on a portrait photo would leave the height unbounded.
      const probe = await createImageBitmap(file);
      const long = Math.max(probe.width, probe.height);
      if (long <= maxEdge) {
        return { source: probe, width: probe.width, height: probe.height, close: () => probe.close() };
      }
      const k = maxEdge / long;
      const w = Math.max(1, Math.round(probe.width * k));
      const h = Math.max(1, Math.round(probe.height * k));
      probe.close();
      const bm = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
      return { source: bm, width: bm.width, height: bm.height, close: () => bm.close() };
    } catch {
      // Fall through. Some engines reject the resize options, and the probe itself can fail on a
      // file the <img> decoder still manages.
    }
  }

  // Fallback for engines without createImageBitmap, or when it refused the file.
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement | null>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = url;
  });
  if (!img || !img.naturalWidth) {
    URL.revokeObjectURL(url);
    return { reason: "undecodable" };
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

/**
 * Last resort: ask the server to decode what this browser could not.
 *
 * HEIC is why this exists. Every iPhone and many Samsungs shoot it, and no Chromium browser can
 * read it — so without this the honest answer was "go change your camera setting", which is not an
 * answer a seller uploading their portfolio wants to hear. libvips on the server handles it, along
 * with TIFF and GIF.
 *
 * Returns null when the server cannot help either, so the caller still has a real failure to show
 * rather than a spinner.
 */
export async function transcodeViaServer(file: File): Promise<File | null> {
  try {
    const res = await fetch("/api/media/transcode", {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return null;
  }
}

/**
 * Decode with a server fallback. This is what callers should use for anything a user picked.
 *
 * The local attempt runs first so the common case costs nothing; only a file this browser genuinely
 * cannot read is sent anywhere.
 */
export async function decodeImageOrTranscode(
  file: File,
  maxEdge = 2048
): Promise<DecodeResult & { transcoded?: File }> {
  const local = await decodeImageBounded(file, maxEdge);
  if (!isDecodeFailure(local)) return local;

  const converted = await transcodeViaServer(file);
  if (!converted) return local; // keep the ORIGINAL reason: heic vs undecodable still differ

  const second = await decodeImageBounded(converted, maxEdge);
  if (isDecodeFailure(second)) return local;
  return { ...second, transcoded: converted };
}
