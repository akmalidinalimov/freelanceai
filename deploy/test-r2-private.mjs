// Verifies the (all-buckets) R2 token works for BOTH buckets: public bucket PUT+delete,
// and private bucket PUT -> server-side GetObject -> delete (how the app proxy serves it).
// Reads S3_* from .env.deploy.local; secrets are never printed.
import { readFileSync } from "fs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const env = {};
for (const line of readFileSync(new URL("../.env.deploy.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { S3_ENDPOINT, S3_BUCKET, S3_PRIVATE_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;

const s3 = new S3Client({
  region: "auto",
  endpoint: S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
let fail = 0;

async function streamBytes(body) {
  const chunks = [];
  for await (const c of body) chunks.push(c);
  return Buffer.concat(chunks).length;
}

async function testBucket(label, bucket, prefix) {
  const key = `${prefix}/_selftest-${Date.now()}.png`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/png", Body: png }));
    const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const n = await streamBytes(got.Body);
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    const okBytes = n === png.length;
    console.log(`${okBytes ? "✅" : "❌"} ${label} (${bucket}): PUT + server GET (${n}B) + delete`);
    if (!okBytes) fail++;
  } catch (e) {
    fail++;
    console.log(`❌ ${label} (${bucket}): ${e?.name} - ${String(e?.message).slice(0, 120)}`);
  }
}

console.log("=== R2 all-buckets token check ===");
await testBucket("public bucket", S3_BUCKET, "gigs");
if (!S3_PRIVATE_BUCKET) {
  console.log("⚠️  S3_PRIVATE_BUCKET not set");
  fail++;
} else {
  await testBucket("private bucket", S3_PRIVATE_BUCKET, "deliveries");
}
console.log(fail === 0 ? "\n✅ BOTH BUCKETS OK — token covers public + private" : `\n❌ ${fail} check(s) failed`);
process.exit(fail === 0 ? 0 : 1);
