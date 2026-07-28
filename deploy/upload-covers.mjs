// One-off: download the generated AI category covers and upload them to R2 under
// covers/<category>.png. Reads S3_* from .env.deploy.local; prints the public URLs.
import { readFileSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const env = {};
for (const line of readFileSync(new URL("../.env.deploy.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_2zJUonmh6cW6tDKlBEl4CIohbsI/";
const COVERS = {
  "ai-video": "hf_20260629_204759_f04a6aea-f154-4c03-b6b4-22260a2faafc.png",
  "ai-image": "hf_20260629_204827_c4f9d40c-1777-4e19-9cea-a493fdf33391.png",
  "ai-avatar": "hf_20260629_204840_916a7eb2-2eb1-48a9-b29c-c947e3021889.png",
  "ai-ads": "hf_20260629_204850_43281d25-812a-425c-b1a6-859632d3ee8f.png",
  "ai-ugc": "hf_20260629_204853_8110e32b-83d1-4684-b2fa-6931cb1e8fc0.png",
  "voiceover": "hf_20260629_204857_15a5f1c2-f87c-47c2-a2ed-cffdcfc7f34b.png",
  "ai-music": "hf_20260629_204900_bdd0b9bb-71e8-4262-b4c1-2b924f4d491e.png",
  "branding": "hf_20260629_204903_0429c73a-2c02-44ca-8165-2f61d69ddf86.png",
  "ai-product": "hf_20260629_204906_a8a864bc-7a10-44f3-80c2-b0dc0a0386e5.png",
  "image-editing": "hf_20260629_204911_5db55199-20e6-456f-8da9-af6e6fce2733.png",
  "ai-presentation": "hf_20260629_204914_249cab53-fe84-4d4c-a208-63ae7ee9ca6c.png",
  "ai-character": "hf_20260629_204920_4057edd0-b7bf-483b-b603-e05a5174643b.png",
};

const s3 = new S3Client({
  region: "auto",
  endpoint: env.S3_ENDPOINT,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});
const publicBase = env.S3_PUBLIC_BASE_URL.replace(/\/$/, "");

for (const [cat, file] of Object.entries(COVERS)) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.log(`✗ ${cat}: download ${res.status}`);
    continue;
  }
  const body = Buffer.from(await res.arrayBuffer());
  const key = `covers/${cat}.png`;
  await s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: "image/png", Body: body })
  );
  // verify public
  const url = `${publicBase}/${key}`;
  const head = await fetch(url, { method: "GET" });
  console.log(`✓ ${cat.padEnd(16)} ${(body.length / 1024).toFixed(0)}KB  ${url}  (public ${head.status})`);
}
console.log("done");
