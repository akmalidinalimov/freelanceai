import crypto from "node:crypto";

/**
 * PII encryption at rest (AES-256-GCM). Used for fields whose leak would expose
 * personal data (KYC phone numbers) but which are never queried/filtered by value.
 *
 * Key: PII_ENCRYPTION_KEY env — base64-encoded 32 bytes. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Format: enc.v1.<iv b64>.<tag b64>.<ciphertext b64> — versioned for future rotation.
 * decryptPII is tolerant: values without the prefix are returned as-is, so rows
 * written before this shipped (plaintext) keep working and get encrypted on their
 * next write. Without a key configured, encryptPII passes through (warns once) so
 * a missing env never breaks signups — but prod MUST set the key.
 */

const PREFIX = "enc.v1.";
let warned = false;

function key(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

export function encryptPII(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  const k = key();
  if (!k) {
    if (!warned) {
      warned = true;
      console.warn("[pii-crypto] PII_ENCRYPTION_KEY missing/invalid — storing PII unencrypted");
    }
    return value;
  }
  if (value.startsWith(PREFIX)) return value; // already encrypted — never double-wrap
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64")).join(".");
}

export function decryptPII(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row
  const k = key();
  if (!k) return "•••"; // encrypted but no key available — never surface ciphertext
  try {
    const [iv, tag, ct] = value.slice(PREFIX.length).split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return "•••"; // wrong key / corrupted — fail closed, don't crash pages
  }
}
