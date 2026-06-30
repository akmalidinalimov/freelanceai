import "server-only";
import crypto from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/api";
import { tgSendMessage } from "@/lib/telegram-bot";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

/**
 * KYC verification codes — a one-time 6-digit code delivered over the Telegram bot or
 * email (no SMS). A successful verification marks the user kycStatus VERIFIED (and, for
 * the email channel, sets emailVerified). The strongest phone proof is the Telegram
 * `requestContact` share (see telegram-bot.ts) — this code path is the fallback/email path.
 */
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

export type VerifyChannel = "telegram" | "email";

/** Generate + store a hashed code and deliver it over the chosen channel. Returns the code. */
export async function requestVerificationCode(user: User, channel: VerifyChannel): Promise<string> {
  if (channel === "telegram" && !user.telegramId) {
    throw Errors.validation({ channel: "No Telegram account linked" });
  }
  if (channel === "email" && !user.email) {
    throw Errors.validation({ channel: "No email on file" });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyCodeHash: hashCode(code),
      verifyCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      verifyAttempts: 0,
      verifyChannel: channel,
    },
  });

  if (channel === "telegram") {
    await tgSendMessage(
      user.telegramId!,
      `🔐 FreelanceAI tasdiqlash kodi: ${code}\n\nKod 10 daqiqa amal qiladi. Agar bu siz boʻlmasangiz, eʼtibor bermang.`
    );
  } else {
    const { text, html } = renderBrandedEmail({
      title: "Your verification code",
      lines: [`Your FreelanceAI verification code is ${code}.`, "It expires in 10 minutes."],
    });
    await sendEmail(user.email!, "FreelanceAI verification code", text, html);
  }
  return code;
}

/** Verify a submitted code. On success → kycStatus VERIFIED (+ emailVerified for email). */
export async function verifyCode(user: User, code: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { verifyCodeHash: true, verifyCodeExpiresAt: true, verifyAttempts: true, verifyChannel: true },
  });
  if (!u?.verifyCodeHash || !u.verifyCodeExpiresAt || u.verifyCodeExpiresAt < new Date()) {
    throw Errors.validation({ code: "Code expired — request a new one" });
  }
  if (u.verifyAttempts >= MAX_ATTEMPTS) {
    throw Errors.validation({ code: "Too many attempts — request a new code" });
  }
  if (hashCode(code) !== u.verifyCodeHash) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    throw Errors.validation({ code: "Incorrect code" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyCodeHash: null,
      verifyCodeExpiresAt: null,
      verifyAttempts: 0,
      verifyChannel: null,
      kycStatus: "VERIFIED",
      ...(u.verifyChannel === "email" ? { emailVerified: new Date() } : {}),
    },
  });
  await audit({
    actorId: user.id,
    action: "kyc.verify.code",
    entity: "User",
    entityId: user.id,
    metadata: { channel: u.verifyChannel ?? null },
  });
}
