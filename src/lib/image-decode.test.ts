import { describe, it, expect } from "vitest";
import { looksLikeHeic } from "@/lib/image-decode";

/**
 * HEIC has to be sniffed from the bytes, not from `file.type`.
 *
 * Android's picker routinely reports `image/*`, an empty string, or even `image/jpeg` for a HEIF
 * file, so trusting the MIME string is how a user ends up being told to "try a JPG or PNG" about a
 * photo their camera just took. The container is ISO-BMFF: bytes 4..8 are "ftyp" and the brand that
 * follows names the codec.
 */
function fileWith(bytes: number[], type = ""): File {
  return new File([new Uint8Array(bytes)], "photo", { type });
}

/** [size][ftyp][brand] — the first 12 bytes are all the sniff reads. */
const ftyp = (brand: string, extra: number[] = []) =>
  fileWith([
    0, 0, 0, 0x18,
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    ...brand.split("").map((c) => c.charCodeAt(0)),
    ...extra,
  ]);

describe("looksLikeHeic", () => {
  it("detects the HEIF brands a phone actually produces", async () => {
    for (const brand of ["heic", "heix", "hevc", "heif", "mif1", "msf1"]) {
      expect(await looksLikeHeic(ftyp(brand)), brand).toBe(true);
    }
  });

  it("detects HEIC even when the picker lies and calls it image/jpeg", async () => {
    // The exact case that made the old error message wrong.
    const f = new File([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])], "IMG.HEIC", {
      type: "image/jpeg",
    });
    expect(await looksLikeHeic(f)).toBe(true);
  });

  it("does NOT flag a real JPEG", async () => {
    // A false positive here would refuse a perfectly good photo, which is worse than the bug.
    expect(await looksLikeHeic(fileWith([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1], "image/jpeg"))).toBe(false);
  });

  it("does NOT flag a real PNG", async () => {
    expect(await looksLikeHeic(fileWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d], "image/png"))).toBe(false);
  });

  it("does NOT flag an MP4, which shares the ftyp container", async () => {
    // Same ISO-BMFF header — only the brand separates them, which is why the brand is checked.
    expect(await looksLikeHeic(ftyp("isom"))).toBe(false);
    expect(await looksLikeHeic(ftyp("mp42"))).toBe(false);
  });

  it("is case-insensitive about the brand", async () => {
    expect(await looksLikeHeic(ftyp("HEIC"))).toBe(true);
  });

  it("does not throw on a truncated or empty file", async () => {
    expect(await looksLikeHeic(fileWith([]))).toBe(false);
    expect(await looksLikeHeic(fileWith([0, 0, 0]))).toBe(false);
  });
});
