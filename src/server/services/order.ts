import "server-only";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, PackageTier, User } from "@prisma/client";
import { orderWhereForUser, assertFound } from "@/lib/authz";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/server/services/activity";
import { canTransition } from "@/lib/order-state";
import { orderTotals, couponDiscount } from "@/lib/commission";
import { recomputeSellerStats } from "@/server/services/profile";
import { notifyAndPush } from "@/server/services/notification";
import { findValidCoupon } from "@/server/services/coupon";
import { issueReferralReward } from "@/server/services/affiliate";

function commissionPct(): number {
  const n = Number(process.env.PLATFORM_COMMISSION_PCT ?? "20");
  return Number.isFinite(n) ? n : 20;
}

/** Place an order on a gig package (+ optional add-ons). No payment yet → starts IN_PROGRESS. */
export async function createOrder(
  buyerId: string,
  gigId: string,
  tier: PackageTier,
  requirements?: string,
  requirementFileUrls: string[] = [],
  extraIds: string[] = [],
  couponCode?: string,
  requirementAnswers: { q: string; a: string }[] = []
) {
  const gig = await prisma.gig.findFirst({
    where: { id: gigId, status: "ACTIVE" },
    include: {
      packages: { where: { tier } },
      extras: extraIds.length ? { where: { id: { in: extraIds } } } : false,
    },
  });
  if (!gig) throw Errors.notFound("Gig not found");
  if (gig.sellerId === buyerId) throw Errors.forbidden("You cannot order your own gig");
  const pkg = gig.packages[0];
  if (!pkg) throw Errors.validation({ tier: "Package not available" });

  const selectedExtras = gig.extras ?? [];
  const { amountUzs, commissionUzs, sellerNetUzs, extrasUzs, extraDays } = orderTotals(
    pkg.priceUzs,
    selectedExtras.map((e) => ({ priceUzs: e.priceUzs, deliveryDays: e.deliveryDays })),
    commissionPct()
  );

  // Apply a promo code if one is valid (platform-funded; capped so the platform keeps ≥0).
  let discountUzs = 0;
  let appliedCode: string | null = null;
  let couponId: string | null = null;
  if (couponCode?.trim()) {
    const coupon = await findValidCoupon(couponCode);
    if (coupon) {
      discountUzs = couponDiscount(coupon, amountUzs, commissionUzs);
      if (discountUzs > 0) {
        appliedCode = coupon.code;
        couponId = coupon.id;
      }
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { uses: { increment: 1 } } });
    // NOTE: promo/referral credit is applied at PAYMENT SETTLEMENT (postOrderPaymentTx),
    // never here — so an unpaid order that's abandoned or cancelled never spends credit.
    return tx.order.create({
      data: {
        gigId: gig.id,
        buyerId,
        sellerId: gig.sellerId,
        packageTier: tier,
        packageTitle: pkg.title,
        amountUzs,
        commissionUzs,
        sellerNetUzs,
        extrasUzs,
        extrasSnapshot: selectedExtras.length
          ? selectedExtras.map((e) => ({ title: e.title, priceUzs: e.priceUzs }))
          : undefined,
        couponCode: appliedCode,
        discountUzs,
        requirements: requirements?.trim() || null,
        requirementAnswers: requirementAnswers.length
          ? requirementAnswers.map((a) => ({ q: a.q.slice(0, 200), a: a.a.slice(0, 1000) })).filter((a) => a.a)
          : undefined,
        requirementFileUrls: requirementFileUrls.slice(0, 10),
        // Awaiting (manual) payment confirmation before work begins.
        status: "PENDING_PAYMENT",
        dueAt: new Date(Date.now() + (pkg.deliveryDays + extraDays) * 24 * 60 * 60 * 1000),
      },
    });
  });
  await audit({ actorId: buyerId, action: "order.create", entity: "Order", entityId: order.id });
  void trackEvent("order_created", { userId: buyerId, entityId: order.id, meta: { gigId: gig.id } });
  return order;
}

/** Create a PENDING_PAYMENT order from an accepted custom offer (custom price, no extras). */
export async function createOrderFromOffer(offer: {
  buyerId: string;
  sellerId: string;
  gigId: string;
  title: string;
  priceUzs: number;
  deliveryDays: number;
}) {
  // Re-validate at accept time — the offer may be stale (gig paused/deleted, seller changed).
  const gig = await prisma.gig.findFirst({
    where: { id: offer.gigId, status: "ACTIVE", deletedAt: null },
    select: { sellerId: true },
  });
  if (!gig) throw Errors.notFound("This gig is no longer available");
  if (gig.sellerId !== offer.sellerId) throw Errors.forbidden("Offer is no longer valid");
  if (offer.buyerId === offer.sellerId) throw Errors.forbidden("You cannot order your own gig");

  const { amountUzs, commissionUzs, sellerNetUzs } = orderTotals(offer.priceUzs, [], commissionPct());
  const order = await prisma.order.create({
    data: {
      gigId: offer.gigId,
      buyerId: offer.buyerId,
      sellerId: offer.sellerId,
      packageTier: "BASIC",
      packageTitle: offer.title,
      amountUzs,
      commissionUzs,
      sellerNetUzs,
      status: "PENDING_PAYMENT",
      dueAt: new Date(Date.now() + offer.deliveryDays * 24 * 60 * 60 * 1000),
    },
  });
  await audit({ actorId: offer.buyerId, action: "order.create.offer", entity: "Order", entityId: order.id });
  return order;
}

/** Re-order: place a fresh order for the same gig + package as a past order of the buyer's. */
export async function reorderOrder(orderId: string, user: User): Promise<string> {
  const prev = await prisma.order.findUnique({
    where: { id: orderId },
    select: { buyerId: true, gigId: true, packageTier: true },
  });
  if (!prev) throw Errors.notFound("Order not found");
  if (prev.buyerId !== user.id) throw Errors.forbidden();
  // createOrder reads the current gig (price/availability), so a reorder always reflects today's terms.
  const fresh = await createOrder(user.id, prev.gigId, prev.packageTier);
  return fresh.id;
}

export function listBuyerOrders(buyerId: string) {
  return prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: {
      gig: { select: { title: true, slug: true } },
      seller: { select: { firstName: true, name: true, username: true } },
      review: { select: { id: true } },
    },
  });
}

export function listSellerOrders(sellerId: string) {
  return prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      gig: { select: { title: true, slug: true } },
      buyer: { select: { firstName: true, name: true, username: true } },
    },
  });
}

/** Ownership-scoped fetch (buyer/seller/admin only) or 404. */
export async function getOrderForUser(orderId: string, user: Pick<User, "id" | "role">) {
  const order = await prisma.order.findFirst({
    where: orderWhereForUser(orderId, user),
    include: {
      gig: { select: { title: true, slug: true } },
      deliveries: { orderBy: { createdAt: "asc" } },
      buyer: { select: { firstName: true, username: true, name: true } },
      seller: { select: { firstName: true, username: true, name: true } },
    },
  });
  return assertFound(order, "Order not found");
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) {
    throw Errors.conflict(`Cannot move order from ${from} to ${to}`);
  }
}

/** Seller delivers work → DELIVERED. */
export async function deliverOrder(orderId: string, seller: User, message: string, fileUrls: string[] = []) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.sellerId !== seller.id && seller.role !== "ADMIN") throw Errors.forbidden();
  assertTransition(order.status, "DELIVERED");
  await prisma.$transaction([
    prisma.orderDelivery.create({ data: { orderId, message: message.trim() || null, fileUrls } }),
    prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } }),
  ]);
  await audit({ actorId: seller.id, action: "order.deliver", entity: "Order", entityId: orderId });
  await notifyAndPush(order.buyerId, "order.delivered", "Buyurtmangiz topshirildi", {
    body: "Ijrochi ishni topshirdi — koʻrib chiqing.",
    // One-tap actions right in the Telegram chat.
    buttons: [
      [
        { text: "✅ Qabul qilish", callback_data: `o:acc:${orderId}` },
        { text: "✏️ Oʻzgartirish", callback_data: `o:rev:${orderId}` },
      ],
    ],
  });
}

/** Buyer accepts a delivery → COMPLETED. */
export async function acceptOrder(orderId: string, buyer: User) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id && buyer.role !== "ADMIN") throw Errors.forbidden();
  assertTransition(order.status, "COMPLETED");
  await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await recomputeSellerStats(order.sellerId);
  // Reward the buyer's referrer on their first completed order (idempotent, best-effort).
  await issueReferralReward({ id: order.id, buyerId: order.buyerId, commissionUzs: order.commissionUzs });
  await audit({ actorId: buyer.id, action: "order.complete", entity: "Order", entityId: orderId });
  await notifyAndPush(order.sellerId, "order.completed", "Buyurtma yakunlandi", {
    body: "Buyurtmachi ishni qabul qildi. Mablagʻ hisobingizga oʻtkazildi.",
    link: `/orders/${orderId}`,
  });
}

/** Buyer requests changes → REVISION. */
export async function requestRevision(orderId: string, buyer: User) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id && buyer.role !== "ADMIN") throw Errors.forbidden();
  assertTransition(order.status, "REVISION");
  await prisma.order.update({ where: { id: orderId }, data: { status: "REVISION" } });
  await audit({ actorId: buyer.id, action: "order.revision", entity: "Order", entityId: orderId });
  await notifyAndPush(order.sellerId, "order.revision", "Oʻzgartirish soʻraldi", {
    body: "Buyurtmachi ishga oʻzgartirish kiritishni soʻradi — batafsil buyurtmada.",
    link: `/orders/${orderId}`,
  });
}

/** Auto-complete deliveries the buyer didn't act on after `days`. Returns the count completed. */
export async function autoCompleteDeliveredOrders(days = 3): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Fetch the due orders first (bounded) so we can issue referral rewards per completion.
  const due = await prisma.order.findMany({
    where: { status: "DELIVERED", deliveredAt: { lt: cutoff } },
    select: { id: true, buyerId: true, commissionUzs: true },
    take: 500,
  });
  if (due.length === 0) return 0;
  const res = await prisma.order.updateMany({
    where: { id: { in: due.map((o) => o.id) }, status: "DELIVERED" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  // First-completed-order referral reward (idempotent per referee, best-effort).
  for (const o of due) await issueReferralReward(o);
  return res.count;
}

/** Buyer or seller cancels an active order → CANCELLED. */
export async function cancelOrder(orderId: string, user: User) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== "ADMIN") {
    throw Errors.forbidden();
  }
  assertTransition(order.status, "CANCELLED");
  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await audit({ actorId: user.id, action: "order.cancel", entity: "Order", entityId: orderId });
}
