import "server-only";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) media uploads via presigned PUT — the file goes
 * browser → R2 directly (never through the app). Content-type is pinned into the
 * signature (no type spoofing); SVG is denied (XSS); served from a separate cookieless
 * public domain. Size is enforced client-side + capped here; a post-upload HEAD/scan
 * is a tracked hardening follow-up.
 */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

function r2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export function mediaConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_PUBLIC_BASE_URL
  );
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/** Validate type/size and return a presigned PUT + the eventual public URL. */
export async function presignUpload(
  prefix: "gigs" | "portfolio" | "deliveries",
  contentType: string,
  size: number
): Promise<PresignResult> {
  if (!mediaConfigured()) throw new Error("media_not_configured");

  const isImage = IMAGE_TYPES.includes(contentType);
  const isVideo = VIDEO_TYPES.includes(contentType);
  if (!isImage && !isVideo) throw new Error("unsupported_type");
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!Number.isFinite(size) || size <= 0 || size > max) throw new Error("too_large");

  const key = `${prefix}/${crypto.randomBytes(16).toString("hex")}.${EXT[contentType]}`;
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(r2(), command, { expiresIn: 300 });
  const publicUrl = `${process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key };
}
