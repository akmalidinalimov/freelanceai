import "server-only";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, PackageTier, User } from "@prisma/client";
import { orderWhereForUser, assertFound } from "@/lib/authz";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canTransition } from "@/lib/order-state";

function commissionPct(): number {
  const n = Number(process.env.PLATFORM_COMMISSION_PCT ?? "20");
  return Number.isFinite(n) ? n : 20;
}

/** Place an order on a gig package. No payment yet → starts IN_PROGRESS. */
export async function createOrder(buyerId: string, gigId: string, tier: PackageTier, requirements?: string) {
  const gig = await prisma.gig.findFirst({
    where: { id: gigId, status: "ACTIVE" },
    include: { packages: { where: { tier } } },
  });
  if (!gig) throw Errors.notFound("Gig not found");
  if (gig.sellerId === buyerId) throw Errors.forbidden("You cannot order your own gig");
  const pkg = gig.packages[0];
  if (!pkg) throw Errors.validation({ tier: "Package not available" });

  const amountUzs = pkg.priceUzs;
  const commissionUzs = Math.round((amountUzs * commissionPct()) / 100);
  const order = await prisma.order.create({
    data: {
      gigId: gig.id,
      buyerId,
      sellerId: gig.sellerId,
      packageTier: tier,
      packageTitle: pkg.title,
      amountUzs,
      commissionUzs,
      sellerNetUzs: amountUzs - commissionUzs,
      requirements: requirements?.trim() || null,
      status: "IN_PROGRESS",
      dueAt: new Date(Date.now() + pkg.deliveryDays * 24 * 60 * 60 * 1000),
    },
  });
  await audit({ actorId: buyerId, action: "order.create", entity: "Order", entityId: order.id });
  return order;
}

export function listBuyerOrders(buyerId: string) {
  return prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: { gig: { select: { title: true, slug: true } } },
  });
}

export function listSellerOrders(sellerId: string) {
  return prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: { gig: { select: { title: true, slug: true } } },
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
}

/** Buyer accepts a delivery → COMPLETED. */
export async function acceptOrder(orderId: string, buyer: User) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id && buyer.role !== "ADMIN") throw Errors.forbidden();
  assertTransition(order.status, "COMPLETED");
  await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await audit({ actorId: buyer.id, action: "order.complete", entity: "Order", entityId: orderId });
}

/** Buyer requests changes → REVISION. */
export async function requestRevision(orderId: string, buyer: User) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Errors.notFound("Order not found");
  if (order.buyerId !== buyer.id && buyer.role !== "ADMIN") throw Errors.forbidden();
  assertTransition(order.status, "REVISION");
  await prisma.order.update({ where: { id: orderId }, data: { status: "REVISION" } });
  await audit({ actorId: buyer.id, action: "order.revision", entity: "Order", entityId: orderId });
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
