import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { isOwnUpload } from "@/lib/media";
import { addPortfolioItem } from "@/server/services/profile";

const schema = z
  .object({
    intent: z.enum(["buy", "sell"]),
    // Step 1 — identity confirmation (prefilled from the auth provider; editable).
    firstName: z.string().trim().max(60).optional(),
    lastName: z.string().trim().max(60).optional(),
    // Step 2 (sellers) — trust credentials. Experience is the band's lower bound
    // (0 / 1 / 3 / 5); portfolio URLs must be our own R2 uploads.
    experienceYears: z.number().int().min(0).max(50).optional(),
    portfolioUrls: z.array(z.string().min(1).max(500)).max(12).optional(),
  })
  .strict();

/**
 * Complete onboarding. `buy` marks the user onboarded; `sell` turns on the seller
 * capability (isSeller) + creates a SellerProfile. The seller step may be called a
 * second time to attach credentials (experience, portfolio) gathered AFTER the role
 * switch — uploads need the seller capability, so step 2 posts separately.
 * Role/admin are never set here.
 */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();

  if (body.portfolioUrls?.some((u) => !isOwnUpload(u))) {
    throw Errors.validation({ portfolioUrls: "Only uploaded files are allowed" });
  }

  // Identity: fill only what was provided; empty last name clears (it's optional).
  const nameData = {
    ...(body.firstName !== undefined && body.firstName.trim() ? { firstName: body.firstName.trim() } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName.trim() || null } : {}),
  };

  if (body.intent === "sell") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isSeller: true, onboardingCompleted: true, ...nameData },
      }),
      prisma.sellerProfile.upsert({
        where: { userId: user.id },
        update: body.experienceYears !== undefined ? { experienceYears: body.experienceYears } : {},
        create: { userId: user.id, ...(body.experienceYears !== undefined ? { experienceYears: body.experienceYears } : {}) },
      }),
    ]);
    // Portfolio samples from the onboarding step (best-effort per item, capped by schema).
    for (const url of body.portfolioUrls ?? []) {
      await addPortfolioItem(user.id, url, "image").catch(() => {});
    }
    await audit({
      actorId: user.id,
      action: "onboarding.become_seller",
      entity: "User",
      entityId: user.id,
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true, ...nameData },
    });
    await audit({ actorId: user.id, action: "onboarding.buyer", entity: "User", entityId: user.id });
  }

  return ok({ done: true });
});
