import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { transcodeToWebp, canTranscode, canDecodeHeif } from "@/lib/image-transcode";

/**
 * Server-side rescue for images no browser can decode. HEIC is the reason it exists: every iPhone
 * and many Samsungs shoot it, and no Chromium browser reads it, so without this the only honest
 * answer to a seller was "go change your camera setting".
 */
const jpeg = async (w = 400, h = 300) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#c0562a" } })
    .jpeg()
    .toBuffer();

describe("transcodeToWebp", () => {
  it("converts a JPEG to webp", async () => {
    const r = await transcodeToWebp(await jpeg());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contentType).toBe("image/webp");
    expect((await sharp(r.body).metadata()).format).toBe("webp");
  });

  it("bounds the long edge at 2048 and keeps the aspect ratio", async () => {
    const r = await transcodeToWebp(await jpeg(8000, 6000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(2048);
    expect(Math.abs(r.width / r.height - 8000 / 6000)).toBeLessThan(0.01);
  });

  it("does NOT upscale a small image", async () => {
    // withoutEnlargement — blowing a 200px avatar up to 2048 would add bytes and no detail.
    const r = await transcodeToWebp(await jpeg(200, 150));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.width).toBe(200);
  });

  it("strips metadata, so GPS from a portfolio photo never reaches public storage", async () => {
    const withExif = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#fff" } })
      .withMetadata({ exif: { IFD0: { Copyright: "gigora-test" } } })
      .jpeg()
      .toBuffer();
    const r = await transcodeToWebp(withExif);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await sharp(r.body).metadata()).exif).toBeUndefined();
  });

  it("rejects garbage rather than throwing", async () => {
    const r = await transcodeToWebp(Buffer.from("this is not an image"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(["unsupported", "failed"]).toContain(r.reason);
  });

  it("refuses a decompression bomb", async () => {
    // A tiny file that decodes to an enormous bitmap. libvips would happily try; the pixel ceiling
    // is what stops one request costing us gigabytes.
    const bomb = await sharp({ create: { width: 12000, height: 12000, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const r = await transcodeToWebp(bomb);
    // 144MP exceeds the 100MP ceiling — refused, and refused by REASON, not by crashing.
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("too_large");
  }, 60_000);
});

describe("canTranscode", () => {
  it("accepts HEIC only when this build can actually decode it", () => {
    expect(canTranscode("image/heic", true)).toBe(canDecodeHeif());
  });

  it("accepts the formats libvips reads that browsers may not", () => {
    for (const t of ["image/tiff", "image/gif", "image/bmp"]) {
      expect(canTranscode(t, false), t).toBe(true);
    }
  });

  it("refuses anything that is not an image we intend to rescue", () => {
    for (const t of ["application/pdf", "image/svg+xml", "video/mp4", ""]) {
      expect(canTranscode(t, false), t).toBe(false);
    }
  });
});

describe("canDecodeHeif", () => {
  it("reports a boolean without throwing on any build", () => {
    // The value differs per platform — a developer's binary is not the container's — which is
    // exactly why it is reported from /api/health instead of assumed.
    expect(typeof canDecodeHeif()).toBe("boolean");
  });
});
