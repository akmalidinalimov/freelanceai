import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { orderWhereForUser } from "@/lib/authz";
import { Errors } from "@/lib/api";
import { tgSendMessage } from "@/lib/telegram-bot";

const SENDER_SELECT = {
  select: { id: true, firstName: true, name: true, username: true },
} as const;

/** Messages on an order's conversation, oldest first. `after` (ISO) returns only newer ones. */
export async function listMessages(orderId: string, user: Pick<User, "id" | "role">, after?: string) {
  const order = await prisma.order.findFirst({ where: orderWhereForUser(orderId, user) });
  if (!order) throw Errors.notFound("Order not found");
  const convo = await prisma.conversation.findUnique({ where: { orderId } });
  if (!convo) return [];
  const afterDate = after ? new Date(after) : null;
  return prisma.message.findMany({
    where: {
      conversationId: convo.id,
      ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: SENDER_SELECT },
  });
}

/** Post a message on an order (buyer/seller/admin); best-effort Telegram notify to the other party. */
export async function postMessage(orderId: string, sender: User, body: string) {
  const text = body.trim();
  if (!text) throw Errors.validation({ body: "Message is empty" });
  if (text.length > 2000) throw Errors.validation({ body: "Message is too long" });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: true, seller: true, gig: { select: { title: true } } },
  });
  if (!order) throw Errors.notFound("Order not found");
  const isParty =
    order.buyerId === sender.id || order.sellerId === sender.id || sender.role === "ADMIN";
  if (!isParty) throw Errors.forbidden();

  const convo = await prisma.conversation.upsert({
    where: { orderId },
    create: { orderId },
    update: {},
  });
  const message = await prisma.message.create({
    data: { conversationId: convo.id, senderId: sender.id, body: text },
    include: { sender: SENDER_SELECT },
  });

  // Notify the counterpart on Telegram (best-effort; only when a buyer or seller sends).
  const counterpart =
    order.buyerId === sender.id ? order.seller : order.sellerId === sender.id ? order.buyer : null;
  if (counterpart?.telegramId) {
    const origin = process.env.APP_ORIGIN ?? "https://freelanceai.aicreator.academy";
    const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    void tgSendMessage(
      counterpart.telegramId,
      `💬 New message on "${order.gig.title}"\n\n${preview}\n\n${origin}/uz/orders/${orderId}`
    );
  }
  return message;
}
