import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { decryptPII } from "@/lib/pii-crypto";
import { sellerAvailableUzs } from "@/server/services/payments";

/**
 * User data rights: export (portable JSON of everything we hold about the account)
 * and deletion. Deletion ANONYMIZES rather than hard-deletes: orders, ledger entries,
 * reviews and messages are kept (the other party's business/financial record and the
 * platform's accounting integrity), but every personal identifier is removed and the
 * account becomes unusable/undiscoverable (status DELETED; public surfaces filter ACTIVE).
 */

const ACTIVE_ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION",
  "DISPUTED",
] as const;

/** Everything we hold about the caller, as portable JSON. */
export async function exportOwnData(userId: string) {
  const [user, profile, gigs, ordersAsBuyer, ordersAsSeller, reviews, payouts, follows, saved] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          locale: true,
          isSeller: true,
          kycStatus: true,
          payoutCardMasked: true,
          notifyTelegram: true,
          notifyEmail: true,
          notifyPrefs: true,
          createdAt: true,
        },
      }),
      prisma.sellerProfile.findUnique({
        where: { userId },
        include: { portfolio: true },
      }),
      prisma.gig.findMany({
        where: { sellerId: userId },
        select: { id: true, title: true, slug: true, status: true, tags: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { buyerId: userId },
        select: { id: true, status: true, amountUzs: true, createdAt: true, gig: { select: { title: true } } },
      }),
      prisma.order.findMany({
        where: { sellerId: userId },
        select: { id: true, status: true, amountUzs: true, sellerNetUzs: true, createdAt: true, gig: { select: { title: true } } },
      }),
      prisma.review.findMany({
        where: { authorId: userId },
        select: { id: true, rating: true, comment: true, createdAt: true, gig: { select: { title: true } } },
      }),
      prisma.payoutRequest.findMany({
        where: { sellerId: userId },
        select: { id: true, amountUzs: true, status: true, createdAt: true },
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { seller: { select: { username: true } }, createdAt: true },
      }),
      prisma.savedGig.findMany({
        where: { userId },
        select: { gig: { select: { title: true, slug: true } }, createdAt: true },
      }),
    ]);
  if (!user) throw Errors.notFound("Account not found");

  return {
    exportedAt: new Date().toISOString(),
    account: { ...user, phone: decryptPII(user.phone) },
    sellerProfile: profile,
    gigs,
    ordersAsBuyer,
    ordersAsSeller,
    reviewsWritten: reviews,
    payoutRequests: payouts,
    following: follows,
    savedGigs: saved,
  };
}

/**
 * Anonymize-and-close the caller's account. Refuses while money or work is in
 * flight: active orders (either side) or a positive withdrawable balance.
 */
export async function deleteOwnAccount(user: User) {
  if (user.role === "ADMIN") {
    throw Errors.forbidden("Admin accounts cannot self-delete");
  }

  const activeOrders = await prisma.order.count({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
      status: { in: [...ACTIVE_ORDER_STATUSES] },
    },
  });
  if (activeOrders > 0) {
    throw Errors.conflict("Finish or cancel your active orders first");
  }
  if (user.isSeller) {
    const balance = await sellerAvailableUzs(user.id);
    if (balance > 0) {
      throw Errors.conflict("Withdraw your remaining balance first");
    }
  }

  await prisma.$transaction([
    // Unpublish the catalog footprint.
    prisma.gig.updateMany({
      where: { sellerId: user.id },
      data: { status: "PAUSED", deletedAt: new Date() },
    }),
    prisma.portfolioItem.deleteMany({ where: { profile: { userId: user.id } } }),
    prisma.sellerProfile.updateMany({
      where: { userId: user.id },
      data: {
        headline: null,
        bio: null,
        skills: [],
        aiTools: [],
        specializations: [],
        instagramUsername: null,
      },
    }),
    // Remove social/preference footprint.
    prisma.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { sellerId: user.id }] } }),
    prisma.savedGig.deleteMany({ where: { userId: user.id } }),
    prisma.savedSearch.deleteMany({ where: { userId: user.id } }),
    prisma.collection.deleteMany({ where: { userId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    // Kill all access: sessions + linked OAuth accounts.
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    // Strip every personal identifier; orders/ledger/reviews/messages remain
    // (financial + counterparty records) but point at an anonymous shell.
    prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: null,
        username: null,
        firstName: null,
        lastName: null,
        name: null,
        email: null,
        emailVerified: null,
        photoUrl: null,
        image: null,
        phone: null,
        payoutCardMasked: null,
        verifyCodeHash: null,
        verifyCodeExpiresAt: null,
        verifyChannel: null,
        referralCode: null,
        notifyPrefs: undefined,
        notifyTelegram: false,
        notifyEmail: false,
        status: "DELETED",
      },
    }),
  ]);

  await audit({ actorId: user.id, action: "account.delete", entity: "User", entityId: user.id });
}
