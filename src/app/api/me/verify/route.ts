import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { tgRequestContact } from "@/lib/telegram-bot";
import { requestVerificationCode, verifyCode } from "@/server/services/verification";

const schema = z
  .object({
    action: z.enum(["requestTelegramCode", "requestEmailCode", "requestTelegramContact", "verifyCode"]),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();

/** KYC verification: request a code (Telegram/email), request a Telegram contact share, or verify a code. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  enforceRateLimit(`verify:${user.id}`, 5, 60_000);

  if (body.action === "verifyCode") {
    if (!body.code) throw Errors.validation({ code: "Code is required" });
    await verifyCode(user, body.code);
    return ok({ verified: true });
  }

  if (body.action === "requestTelegramContact") {
    if (!user.telegramId) throw Errors.validation({ channel: "No Telegram account linked" });
    await tgRequestContact(
      user.telegramId,
      "Telefon raqamingizni tasdiqlash uchun quyidagi tugmani bosing 👇"
    );
    return ok({ sent: true });
  }

  const channel = body.action === "requestEmailCode" ? "email" : "telegram";
  const code = await requestVerificationCode(user, channel);
  // Only surface the code to the gated E2E suite — never in production.
  return ok({ sent: true, ...(process.env.E2E_TEST_AUTH === "1" ? { code } : {}) });
});
