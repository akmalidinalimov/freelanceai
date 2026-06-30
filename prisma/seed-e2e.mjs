// Deterministic seed for E2E. Idempotent (upserts). Creates a seller, a buyer, and an
// active gig so the authenticated flow spec can order → deliver → accept → review → chat.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { slug: "ai-video" },
    update: {},
    create: { slug: "ai-video", nameUz: "AI video", nameRu: "AI видео", nameEn: "AI video" },
  });

  await prisma.user.upsert({
    where: { id: "e2e_seller" },
    update: { isSeller: true, status: "ACTIVE", kycStatus: "VERIFIED" },
    create: {
      id: "e2e_seller",
      firstName: "E2E Seller",
      username: "e2e_seller",
      isSeller: true,
      role: "BUYER",
      status: "ACTIVE",
      onboardingCompleted: true,
      kycStatus: "VERIFIED",
    },
  });

  await prisma.user.upsert({
    where: { id: "e2e_buyer" },
    update: { status: "ACTIVE" },
    create: {
      id: "e2e_buyer",
      firstName: "E2E Buyer",
      username: "e2e_buyer",
      role: "BUYER",
      status: "ACTIVE",
      onboardingCompleted: true,
    },
  });

  await prisma.user.upsert({
    where: { id: "e2e_admin" },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: "e2e_admin",
      firstName: "E2E Admin",
      username: "e2e_admin",
      role: "ADMIN",
      status: "ACTIVE",
      onboardingCompleted: true,
    },
  });

  // Dedicated user for the KYC code-verification test (has an email channel).
  await prisma.user.upsert({
    where: { id: "e2e_verify" },
    update: { email: "e2e-verify@example.com", kycStatus: "NONE" },
    create: {
      id: "e2e_verify",
      firstName: "E2E Verify",
      username: "e2e_verify",
      email: "e2e-verify@example.com",
      role: "BUYER",
      status: "ACTIVE",
      onboardingCompleted: true,
    },
  });

  await prisma.gig.upsert({
    where: { id: "e2e_gig" },
    update: { status: "ACTIVE" },
    create: {
      id: "e2e_gig",
      sellerId: "e2e_seller",
      title: "E2E test gig — AI promo video",
      slug: "e2e-gig",
      description: "A seeded gig used by the automated end-to-end test suite.",
      status: "ACTIVE",
      locale: "uz",
      packages: {
        create: [
          { tier: "BASIC", title: "Basic", priceUzs: 50000, deliveryDays: 2, revisions: 1 },
        ],
      },
    },
  });

  console.log("E2E seed complete: e2e_seller, e2e_buyer, e2e_admin, gig e2e-gig");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
