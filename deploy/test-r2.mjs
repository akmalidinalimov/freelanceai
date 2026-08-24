// Self-test for Cloudflare R2 media: upload a 1x1 PNG, fetch it from the public URL,
// then delete it. Reads S3_* from .env.deploy.local; secrets are never printed.
import { readFileSync } from "fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = {};
for (const line of readFileSync(new URL("../.env.deploy.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL } = env;

const s3 = new S3Client({
  region: "auto",
  endpoint: S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const key = `gigs/_selftest-${Date.now()}.png`;

try {
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: "image/png", Body: png }));
  console.log("1) PUT to bucket: OK");

  const url = `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type");
  console.log(`2) GET public URL: HTTP ${res.status}, content-type=${ct}, bytes=${buf.length}`);
  console.log(`   public url: ${url}`);
  if (res.status === 200 && buf.length === png.length) {
    console.log("   ✅ PUBLIC ACCESS WORKS — image served correctly");
  } else if (res.status === 401 || res.status === 403) {
    console.log("   ❌ PUBLIC ACCESS DISABLED — enable the bucket's R2.dev Public URL");
  } else {
    console.log("   ⚠️ Unexpected — check the public URL / bucket settings");
  }

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  console.log("3) cleanup: OK");

  // 4) The check this file was MISSING, and the reason every user-facing upload could be broken
  //    while steps 1-3 stayed green: uploads go browser -> R2 directly on a presigned PUT, so
  //    they are governed by the bucket's CORS policy. Steps 1-3 are server-side, where CORS does
  //    not apply. With no policy the preflight returns no Access-Control-Allow-Origin and the
  //    browser refuses to send the PUT at all — avatars, portfolio images and video all fail.
  const origin = (env.APP_ORIGIN || "https://gigora.ai").replace(/\/$/, "");
  const probeKey = `avatars/_corsprobe-${Date.now()}.webp`;
  const signed = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: probeKey, ContentType: "image/webp" }),
    { expiresIn: 120 }
  );
  const pre = await fetch(signed, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allow = pre.headers.get("access-control-allow-origin");
  if (allow === "*" || (allow && origin.startsWith(allow))) {
    console.log(`4) CORS preflight from ${origin}: OK (allow-origin: ${allow})`);
  } else {
    console.log(`4) CORS preflight from ${origin}: HTTP ${pre.status}, allow-origin: ${allow ?? "ABSENT"}`);
    console.log("   ❌ BROWSER UPLOADS ARE BLOCKED — set the bucket CORS policy in Cloudflare:");
    console.log(`      AllowedOrigins ["${origin}"], AllowedMethods ["PUT","GET","HEAD"],`);
    console.log('      AllowedHeaders ["content-type"], ExposeHeaders ["ETag"]');
    process.exitCode = 1;
  }
} catch (e) {
  console.log("ERROR:", e?.name, "-", String(e?.message).slice(0, 200));
  if (e?.name === "NoSuchBucket") console.log("   -> S3_BUCKET name is wrong");
  if (e?.name === "InvalidAccessKeyId" || e?.name === "SignatureDoesNotMatch")
    console.log("   -> S3 access key / secret is wrong, or wrong endpoint");
}
