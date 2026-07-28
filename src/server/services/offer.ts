import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notifyAndPush } from "@/server/services/notification";
import { createOrderFromOffer } from "@/server/services/order";
import { isBlockedBetween } from "@/server/services/blocks";
import { stripContactInfo } from "@/lib/sanitize";

async function loadConvo(conversationId: string, user: User) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { buyerId: true, sellerId: true, gigId: true },
  });
  if (!convo) throw Errors.notFound("Conversation not found");
  if (user.id !== convo.buyerId && user.id !== convo.sellerId) throw Errors.forbidden();
  return convo;
}

export interface OfferInput {
  title: string;
  priceUzs: number;
  deliveryDays: number;
  revisions: number;
}

/** Seller sends a custom offer in a (gig) conversation. */
export async function createOffer(user: User, conversationId: string, input: OfferInput) {
  const convo = await loadConvo(conversationId, user);
  if (!convo.sellerId || !convo.buyerId || !convo.gigId) {
    throw Errors.validation({ offer: "Offers are only available in a gig conversation" });
  }
  if (user.id !== convo.sellerId) throw Errors.forbidden("Only the seller can send an offer");
  if (!input.title.trim()) throw Errors.validation({ title: "Title is required" });
  // A block severs the relationship both ways — a blocked seller can't push an offer either.
  if (await isBlockedBetween(convo.sellerId, convo.buyerId)) throw Errors.forbidden("This conversation is blocked");

  // Strip off-platform contact info from the title — offers are a message channel too, so
  // they must honor the same anti-escrow-bypass control as chat (not a redaction-free hole).
  const cleanTitle = stripContactInfo(input.title.trim().slice(0, 120)).text;

  const offer = await prisma.customOffer.create({
    data: {
      conversationId,
      sellerId: convo.sellerId,
      buyerId: convo.buyerId,
      gigId: convo.gigId,
      title: cleanTitle,
      priceUzs: input.priceUzs,
      deliveryDays: input.deliveryDays,
      revisions: input.revisions,
      status: "PENDING",
    },
  });
  // Rich offer card: show the terms (price · delivery · revisions) right in the push,
  // with the "open" button deep-linking to the thread where the buyer accepts.
  const priceFmt = input.priceUzs.toLocaleString("ru-RU");
  await notifyAndPush(convo.buyerId, "offer.new", "Yangi maxsus taklif 🎁", {
    body:
      `${cleanTitle}\n\n` +
      `💰 ${priceFmt} soʻm · ⏱ ${input.deliveryDays} kun · ✏️ ${input.revisions} marta qayta ishlash\n\n` +
      `Qabul qilish uchun oching 👇`,
    link: `/messages/${conversationId}`,
  });
  await audit({ actorId: user.id, action: "offer.create", entity: "CustomOffer", entityId: offer.id });
  return offer;
}

/** Offers in a conversation (participants only). */
export async function listOffers(conversationId: string, user: User) {
  await loadConvo(conversationId, user);
  return prisma.customOffer.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" } });
}

/** Buyer accepts a pending offer → a PENDING_PAYMENT order. Returns the new order id. */
export async function acceptOffer(offerId: string, user: User): Promise<string> {
  const offer = await prisma.customOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.status !== "PENDING") throw Errors.conflict("Offer is no longer available");
  if (offer.buyerId !== user.id) throw Errors.forbidden("Only the buyer can accept this offer");

  const order = await createOrderFromOffer(offer);
  await prisma.customOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED", orderId: order.id } });
  await audit({ actorId: user.id, action: "offer.accept", entity: "CustomOffer", entityId: offerId });
  await notifyAndPush(offer.sellerId, "offer.accepted", "Taklifingiz qabul qilindi", {
    body: "Buyurtmachi maxsus taklifingizni qabul qildi — toʻlovdan soʻng ishni boshlashingiz mumkin.",
    link: `/orders/${order.id}`,
  });
  return order.id;
}

/** Either party declines a pending offer. */
export async function declineOffer(offerId: string, user: User): Promise<void> {
  const offer = await prisma.customOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.status !== "PENDING") throw Errors.conflict("Offer is no longer available");
  if (offer.buyerId !== user.id && offer.sellerId !== user.id) throw Errors.forbidden();
  await prisma.customOffer.update({ where: { id: offerId }, data: { status: "DECLINED" } });
  await audit({ actorId: user.id, action: "offer.decline", entity: "CustomOffer", entityId: offerId });
  // Notify the other participant (whoever didn't decline).
  const otherId = user.id === offer.sellerId ? offer.buyerId : offer.sellerId;
  await notifyAndPush(otherId, "offer.declined", "Maxsus taklif rad etildi", {
    body: offer.title,
    link: `/messages/${offer.conversationId}`,
  });
}
