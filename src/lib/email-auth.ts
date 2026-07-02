import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Passwordless email login: a single-use, 15-minute magic-link token. The random
 * token is the secret and is stored server-side (VerificationToken) — clicking the
 * link consumes it. No passwords, no reset flows, no nodemailer dependency.
 */
const TTL_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Create + store a magic-link token for an email; returns the raw token for the URL. */
export async function createMagicToken(email: string): Promise<string> {
  const identifier = normalizeEmail(email);
  const token = crypto.randomBytes(32).toString("hex");
  // Sweep only EXPIRED tokens for this address. Outstanding valid links stay live —
  // deleting them here would let an unauthenticated attacker repeatedly void a
  // victim's in-flight link (login-channel DoS). TTL + single-use bound the exposure.
  await prisma.verificationToken
    .deleteMany({ where: { identifier, expires: { lt: new Date() } } })
    .catch(() => {});
  await prisma.verificationToken.create({
    data: { identifier, token, expires: new Date(Date.now() + TTL_MS) },
  });
  return token;
}

/** Validate + CONSUME a magic-link token. Returns the email on success, else null. */
export async function consumeMagicToken(token: string): Promise<string | null> {
  if (!token || token.length < 32) return null;
  const row = await prisma.verificationToken.findFirst({ where: { token } });
  if (!row) return null;
  // Single-use gate: the delete count decides the winner. Under concurrent callback
  // requests (mail-scanner prefetch + real click) exactly one caller deletes the row;
  // the loser gets count 0 and is rejected — no replay.
  const deleted = await prisma.verificationToken.deleteMany({ where: { token } });
  if (deleted.count === 0) return null;
  if (row.expires < new Date()) return null;
  return row.identifier;
}
