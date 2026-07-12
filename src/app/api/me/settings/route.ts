import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { encryptPII } from "@/lib/pii-crypto";
import { notifyAdmins } from "@/server/services/notification";
import type { Prisma } from "@prisma/client";

const schema = z
  .object({
    notifyTelegram: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyPrefs: z
      .object({ orders: z.boolean(), messages: z.boolean(), reviews: z.boolean() })
      .partial()
      .optional(),
    // KYC: phone for payouts (digits, optional leading +; UZ default +998…).
    phone: z
      .string()
      .trim()
      .regex(/^\+?\d{7,15}$/, "Enter a valid phone number")
      .optional(),
    // Seller payout card — only the masked form is ever stored (last 4 kept; PAN never).
    payoutCardMasked: z.string().trim().min(4).max(25).optional(),
  })
  .strict();

/** Update the caller's notification preferences, phone (KYC), and payout card. */
export const PATCH = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();

  const data: Prisma.UserUpdateInput = {};
  if (body.notifyTelegram !== undefined) data.notifyTelegram = body.notifyTelegram;
  if (body.notifyEmail !== undefined) data.notifyEmail = body.notifyEmail;
  if (body.notifyPrefs !== undefined) data.notifyPrefs = body.notifyPrefs;
  if (body.payoutCardMasked !== undefined) data.payoutCardMasked = maskCard(body.payoutCardMasked);
  if (body.phone !== undefined) {
    data.phone = encryptPII(body.phone); // PII at rest (docs/ops.md)
    // Capturing a phone moves an unstarted KYC into PENDING (admin/SMS verifies later).
    if (user.kycStatus === "NONE") data.kycStatus = "PENDING";
  }

  await prisma.user.update({ where: { id: user.id }, data });
  if (data.kycStatus === "PENDING") {
    await notifyAdmins("admin.kyc", "🪪 Yangi KYC tekshiruvi", {
      body: "Foydalanuvchi telefon raqamini yubordi — tasdiqlang.",
      link: "/admin/kyc",
    });
  }
  return ok({ done: true });
});

/** Keep only the last 4 digits visible: "8600 **** **** 1234". Never store the full PAN. */
function maskCard(input: string): string {
  // Store ONLY the last 4 digits — never the BIN/head (which identifies the bank + card range).
  const last4 = input.replace(/\D/g, "").slice(-4);
  return `**** **** **** ${last4}`;
}
