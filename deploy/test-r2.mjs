// Self-test for Cloudflare R2 media: upload a 1x1 PNG, fetch it from the public URL,
// then delete it. Reads S3_* from .env.deploy.local; secrets are never printed.
import { readFileSync } from "fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
} catch (e) {
  console.log("ERROR:", e?.name, "-", String(e?.message).slice(0, 200));
  if (e?.name === "NoSuchBucket") console.log("   -> S3_BUCKET name is wrong");
  if (e?.name === "InvalidAccessKeyId" || e?.name === "SignatureDoesNotMatch")
    console.log("   -> S3 access key / secret is wrong, or wrong endpoint");
}
