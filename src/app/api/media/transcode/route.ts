import { NextResponse } from "next/server";
import { defineHandler } from "@/lib/handler";
import { Errors } from "@/lib/api";
import { requireActive } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/rate-limit";
import { transcodeToWebp, canDecodeHeif } from "@/lib/image-transcode";
import { MAX_IMAGE_BYTES } from "@/lib/media";

/**
 * Convert an image the browser could not decode into a webp it can.
 *
 * Reached only after the client has tried and failed — overwhelmingly HEIC, which every iPhone and
 * many Samsungs shoot by default and no Chromium browser can read. Rather than telling those users
 * to go change a camera setting, we decode it with the libvips already in this image.
 *
 * Bytes route through the app rather than straight to R2, which is a deliberate exception to the
 * presigned-upload design: it applies only to a format the browser cannot handle, the payload is
 * capped, and the alternative was refusing the photo.
 *
 * Guarded like any upload: same-origin (defineHandler's default for POST), an authenticated active
 * user, a per-user rate limit, and a hard byte ceiling checked BEFORE the body is read into memory.
 */
export const POST = defineHandler({ auth: true }, async ({ user, request }) => {
  if (!user) throw Errors.unauthenticated();
  requireActive(user);
  // Per-user, not per-IP: clientIp() collapses to the literal "unknown" without Cloudflare in
  // front, which would merge every uploader into one bucket (audit S12).
  enforceRateLimit(`transcode:${user.id}`, 20, 60_000);

  // Trust the header only to reject early; the real ceiling is the byte length below.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_IMAGE_BYTES) throw Errors.validation({ file: "too_large" });

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.byteLength === 0) throw Errors.validation({ file: "empty" });
  if (buf.byteLength > MAX_IMAGE_BYTES) throw Errors.validation({ file: "too_large" });

  const result = await transcodeToWebp(buf);
  if (!result.ok) {
    // `unsupported` most often means a HEIC on a build of libvips without HEIF, so say which it is
    // — the client shows a different message for "we cannot read this format at all".
    throw Errors.validation({
      file: result.reason,
      heif: canDecodeHeif() ? "available" : "unavailable",
    });
  }

  return new NextResponse(new Uint8Array(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
      "X-Image-Width": String(result.width),
      "X-Image-Height": String(result.height),
    },
  }) as unknown as NextResponse;
});
