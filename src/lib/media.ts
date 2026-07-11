import "server-only";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

const PRIVATE_REF = "r2-private:";

// Prefixes whose contents are private by nature and must never sit at a public, un-authed URL:
// order deliverables, the buyer's requirement brief/files, and chat attachments. They go to the
// private bucket (served only via an access-controlled proxy) when one is configured; without
// S3_PRIVATE_BUCKET they fall back to the public bucket (unchanged behavior).
const PRIVATE_PREFIXES = new Set(["deliveries", "requirements", "messages"]);
function privateBucketFor(prefix: string): string | undefined {
  return PRIVATE_PREFIXES.has(prefix) ? process.env.S3_PRIVATE_BUCKET || undefined : undefined;
}

/**
 * Validate type/size and return a presigned PUT + the value to STORE. For public prefixes the
 * stored value is the public URL; for deliveries on the private bucket it's an opaque
 * `r2-private:<key>` ref that only the access-controlled proxy can resolve (no public URL exists).
 */
export async function presignUpload(
  prefix: "gigs" | "portfolio" | "deliveries" | "requirements" | "messages" | "avatars",
  contentType: string,
  size: number
): Promise<PresignResult> {
  if (!mediaConfigured()) throw new Error("media_not_configured");

  const isImage = IMAGE_TYPES.includes(contentType);
  const isVideo = VIDEO_TYPES.includes(contentType);
  if (!isImage && !isVideo) throw new Error("unsupported_type");
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!Number.isFinite(size) || size <= 0 || size > max) throw new Error("too_large");

  const privateBucket = privateBucketFor(prefix);
  const bucket = privateBucket ?? process.env.S3_BUCKET;
  const key = `${prefix}/${crypto.randomBytes(16).toString("hex")}.${EXT[contentType]}`;
  // Size is capped at presign time (above). We intentionally do NOT bind ContentLength into the
  // signature: signing content-length makes the PUT zero-tolerance (any 1-byte divergence from
  // the browser's actual Content-Length → hard 403), which is fragile across R2/proxies and not
  // worth the marginal "declared-small-then-upload-big" hardening. The proper cap is a
  // post-upload HEAD (tracked); until then the presign-time size check stands.
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(r2(), command, { expiresIn: 300 });
  const publicUrl = privateBucket
    ? `${PRIVATE_REF}${key}`
    : `${process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key };
}

/**
 * Server-side re-host: download a remote image (e.g. an Instagram CDN URL, which
 * expires) and store it in the public bucket. Returns the stable public URL.
 * Images only; capped at MAX_IMAGE_BYTES.
 */
export async function uploadFromUrl(prefix: string, sourceUrl: string): Promise<string> {
  if (!mediaConfigured()) throw new Error("media_not_configured");
  // Only fetch https CDN URLs, and bound the work: reject oversized bodies by their
  // declared Content-Length before buffering, and abort a stalled CDN after 15s so a
  // sequential cron pass can't hang. Defense-in-depth against SSRF / memory bombs even
  // though callers only pass Instagram Graph media URLs today.
  if (!/^https:\/\//i.test(sourceUrl)) throw new Error("bad_scheme");
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`fetch_source_${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!IMAGE_TYPES.includes(contentType)) throw new Error("unsupported_type");
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new Error("too_large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) throw new Error("too_large");
  const key = `${prefix}/${crypto.randomBytes(16).toString("hex")}.${EXT[contentType]}`;
  await r2().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buf,
      ContentType: contentType,
    })
  );
  return `${process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;
}

/**
 * Best-effort delete of a stored media object (public URL or `r2-private:` ref) from R2.
 * Used when a user disconnects Instagram or deletes their account, so re-hosted copies
 * don't outlive the DB rows. Never throws — a missing object or transient error is
 * swallowed so it can't block the surrounding transaction/response.
 */
export async function deleteStoredFile(stored: string): Promise<void> {
  if (!mediaConfigured()) return;
  const resolved = resolveStoredFile(stored);
  if (!resolved) return;
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: resolved.bucket, Key: resolved.key }));
  } catch {
    // best-effort
  }
}

/** Map a stored public URL back to its R2 object key (or null if it isn't one of ours). */
export function keyFromPublicUrl(url: string): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

/** Is this a private-bucket reference (vs a public URL)? */
export function isPrivateRef(stored: string): boolean {
  return stored.startsWith(PRIVATE_REF);
}

// Exact shape of a key we mint: "<prefix>/<32 hex>.<ext>" (crypto.randomBytes(16) + known ext).
// Validating it means a client can't smuggle an arbitrary/cross-prefix key inside an
// `r2-private:` ref (defense-in-depth on top of the 128-bit key entropy).
const OWN_KEY_SHAPE = /^(gigs|portfolio|deliveries|requirements|messages|avatars)\/[0-9a-f]{32}\.(jpg|png|webp|avif|mp4|webm)$/;

/**
 * True if a stored file value is one of OUR uploads — a public-bucket URL or a private-bucket
 * ref — AND its key matches the shape we mint. The single gate for accepting attachment
 * references from clients (order requirements, deliveries, chat): rejects arbitrary external
 * URLs (stored phishing / IP-tracking / SSRF when rendered) AND accepts well-formed private
 * refs (which aren't URLs, so a bare z.string().url() drops them once a private bucket exists).
 */
export function isOwnUpload(stored: string): boolean {
  if (isPrivateRef(stored)) return OWN_KEY_SHAPE.test(stored.slice(PRIVATE_REF.length));
  const key = keyFromPublicUrl(stored);
  return key !== null && OWN_KEY_SHAPE.test(key);
}

/** Resolve a stored file value (public URL or `r2-private:` ref) to its bucket + key. */
export function resolveStoredFile(stored: string): { bucket: string; key: string } | null {
  if (isPrivateRef(stored)) {
    const key = stored.slice(PRIVATE_REF.length);
    const bucket = process.env.S3_PRIVATE_BUCKET;
    return bucket && key ? { bucket, key } : null;
  }
  const key = keyFromPublicUrl(stored);
  const bucket = process.env.S3_BUCKET;
  return key && bucket ? { bucket, key } : null;
}

/**
 * Fetch an object from R2 server-side (authenticated with our creds) for an access-controlled
 * proxy download. Works against either the public or the private bucket.
 */
export async function getObject(
  key: string,
  bucket: string | undefined = process.env.S3_BUCKET
): Promise<{ body: ReadableStream; contentType: string } | null> {
  if (!mediaConfigured() || !bucket) return null;
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return {
      body: (res.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
