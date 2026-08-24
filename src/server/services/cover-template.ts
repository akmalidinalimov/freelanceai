import "server-only";
import sharp from "sharp";
import { putBuffer } from "@/lib/media";
import { buildCoverSvg, type CoverSpec } from "@/lib/cover-template";

/**
 * Render the branded cover template and store it in R2 once. Fonts (Manrope/Unbounded)
 * are installed into the container image — node:alpine ships none, which would render
 * the text as nothing.
 */
export async function generateGigCover(spec: CoverSpec): Promise<{ url: string; bytes: number }> {
  const svg = buildCoverSvg(spec);
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
  const url = await putBuffer("gigs", buf, "image/webp");
  return { url, bytes: buf.byteLength };
}
