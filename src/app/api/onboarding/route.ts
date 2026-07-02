import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const schema = z.object({ intent: z.enum(["buy", "sell"]) }).strict();

/**
 * Complete onboarding. `buy` just marks the user onboarded; `sell` turns on the
 * seller capability (isSeller) + creates a SellerProfile. Role/admin are never set here.
 */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();

  if (body.intent === "sell") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isSeller: true, onboardingCompleted: true },
      }),
      prisma.sellerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      }),
    ]);
    await audit({
      actorId: user.id,
      action: "onboarding.become_seller",
      entity: "User",
      entityId: user.id,
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });
    await audit({ actorId: user.id, action: "onboarding.buyer", entity: "User", entityId: user.id });
  }

  return ok({ done: true });
});
