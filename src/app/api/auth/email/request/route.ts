import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok } from "@/lib/api";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { emailConfigured, sendEmail, renderBrandedEmail } from "@/lib/email";
import { createMagicToken, normalizeEmail } from "@/lib/email-auth";
import { safeInternalPath } from "@/lib/utils";

const schema = z
  .object({
    email: z.string().email().max(200),
    locale: z.enum(["uz", "ru", "en"]).optional(),
    // login-return path; re-validated server-side before entering the magic link
    next: z.string().max(500).optional(),
  })
  .strict();

// Localized copy for the magic-link email (kept server-side; the UI locale is passed in).
const COPY = {
  uz: {
    subject: "Kirish havolasi",
    title: "Hisobingizga kiring",
    line: "Quyidagi tugma orqali kiring. Havola 15 daqiqa ichida amal qiladi.",
    ignore: "Agar bu soʻrovni siz yubormagan boʻlsangiz, bu xatni eʼtiborsiz qoldiring.",
    button: "Kirish",
  },
  ru: {
    subject: "Ссылка для входа",
    title: "Войдите в аккаунт",
    line: "Нажмите кнопку ниже, чтобы войти. Ссылка действует 15 минут.",
    ignore: "Если вы не запрашивали вход, просто проигнорируйте это письмо.",
    button: "Войти",
  },
  en: {
    subject: "Your login link",
    title: "Sign in to your account",
    line: "Use the button below to sign in. This link expires in 15 minutes.",
    ignore: "If you didn't request this, you can safely ignore this email.",
    button: "Sign in",
  },
} as const;

/**
 * Request a passwordless magic-link email. Always responds `{ sent: true }` (never
 * reveals whether the address exists or whether delivery succeeded) to avoid account
 * enumeration. Rate-limited per IP and per address. No-ops safely if email isn't
 * configured. The link lands on /[locale]/auth/email which completes the sign-in.
 */
export const POST = defineHandler({ schema, sameOrigin: true }, async ({ body, request }) => {
  enforceRateLimit(`email-login:ip:${clientIp(request)}`, 6, 60_000);
  enforceRateLimit(`email-login:addr:${normalizeEmail(body.email)}`, 3, 5 * 60_000);

  if (emailConfigured()) {
    const locale = body.locale ?? "uz";
    const copy = COPY[locale];
    const token = await createMagicToken(body.email);
    const origin = (process.env.APP_ORIGIN ?? "https://gigora.ai").replace(/\/$/, "");
    const next = safeInternalPath(body.next ?? null);
    const url = `${origin}/${locale}/auth/email?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const { text, html } = renderBrandedEmail({
      title: copy.title,
      lines: [copy.line, copy.ignore],
      button: { label: copy.button, url },
    });
    await sendEmail(normalizeEmail(body.email), copy.subject, text, html);
  }

  return ok({ sent: true });
});
