import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { Errors } from "@/lib/api";
import { tgSendTracked } from "@/lib/telegram-bot";
import { stripContactInfo } from "@/lib/sanitize";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { publishMessage } from "@/lib/message-bus";
import { notify } from "@/server/services/notification";
import { trackEvent } from "@/server/services/activity";

const SENDER_SELECT = { select: { id: true, firstName: true, name: true, username: true } } as const;
const NAME_SELECT = { select: { firstName: true, name: true, username: true } } as const;

function nameOf(u: { firstName?: string | null; name?: string | null; username?: string | null } | null) {
  return u?.firstName ?? u?.name ?? u?.username ?? "";
}

/** Resolve a conversation + its two participant ids (from the order, or direct fields), enforcing access. */
async function authzConversation(conversationId: string, user: Pick<User, "id" | "role">) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { order: { select: { buyerId: true, sellerId: true } }, gig: { select: { title: true } } },
  });
  if (!convo) throw Errors.notFound("Conversation not found");
  const buyerId = convo.order?.buyerId ?? convo.buyerId;
  const sellerId = convo.order?.sellerId ?? convo.sellerId;
  const isParty = user.id === buyerId || user.id === sellerId || user.role === "ADMIN";
  if (!isParty) throw Errors.notFound("Conversation not found"); // 404 hides existence
  return { convo, buyerId, sellerId };
}

/** Boolean access check for a conversation (used by the SSE stream endpoint). */
export async function canAccessConversation(conversationId: string, user: Pick<User, "id" | "role">) {
  try {
    await authzConversation(conversationId, user);
    return true;
  } catch {
    return false;
  }
}

/** Upsert the conversation tied to an order; returns its id. */
export async function getOrderConversationId(orderId: string) {
  const convo = await prisma.conversation.upsert({
    where: { orderId },
    create: { orderId },
    update: {},
  });
  return convo.id;
}

/** Find (or create) the direct buyer↔seller conversation; returns its id. Can't contact yourself. */
export async function getOrCreateDirectConversation(buyerId: string, sellerId: string, gigId?: string) {
  if (buyerId === sellerId) throw Errors.forbidden("You cannot contact yourself");
  const existing = await prisma.conversation.findUnique({
    where: { buyerId_sellerId: { buyerId, sellerId } },
  });
  if (existing) return existing.id;
  const created = await prisma.conversation.create({
    data: { buyerId, sellerId, gigId: gigId ?? null },
  });
  return created.id;
}

/** Messages in a conversation, oldest first. `after` (ISO) returns only newer ones. */
export async function listConversationMessages(
  conversationId: string,
  user: Pick<User, "id" | "role">,
  after?: string
) {
  await authzConversation(conversationId, user);
  const afterDate = after ? new Date(after) : null;
  return prisma.message.findMany({
    where: {
      conversationId,
      ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: SENDER_SELECT },
  });
}

/** Post a message in a conversation; best-effort Telegram notify to the other participant. */
export async function postConversationMessage(
  conversationId: string,
  user: User,
  body: string,
  fileUrls: string[] = []
) {
  const trimmed = body.trim();
  const files = fileUrls.slice(0, 5);
  if (!trimmed && files.length === 0) throw Errors.validation({ body: "Message is empty" });
  if (trimmed.length > 2000) throw Errors.validation({ body: "Message is too long" });
  // Strip off-platform contact info (anti-escrow-bypass).
  const stripped = trimmed ? stripContactInfo(trimmed) : null;
  const text = stripped?.text ?? null;

  const { convo, buyerId, sellerId } = await authzConversation(conversationId, user);
  // Redactions feed the CONTACT_REDACTED red-flag signal — recorded only for a
  // message that actually posts (after authz), so every flag has visible evidence.
  if (stripped?.redacted) {
    void trackEvent("message_redacted", { userId: user.id, entityId: conversationId });
  }
  const message = await prisma.message.create({
    data: { conversationId, senderId: user.id, body: text, fileUrls: files },
    include: { sender: SENDER_SELECT },
  });

  // Push to any open SSE streams for this conversation (realtime delivery).
  publishMessage({
    id: message.id,
    conversationId,
    body: message.body,
    fileUrls: message.fileUrls,
    senderId: message.senderId,
    sender: {
      firstName: message.sender.firstName,
      name: message.sender.name,
      username: message.sender.username,
    },
    createdAt: message.createdAt.toISOString(),
  });

  const otherId = user.id === buyerId ? sellerId : user.id === sellerId ? buyerId : null;
  if (otherId) {
    const other = await prisma.user.findUnique({
      where: { id: otherId },
      select: { telegramId: true, email: true, notifyTelegram: true, notifyEmail: true },
    });
    if (other) {
      const origin = process.env.APP_ORIGIN ?? "https://gigora.ai";
      const ctx = convo.gig?.title ? ` "${convo.gig.title}"` : "";
      const previewText = text ?? (files.length ? "📎 fayl" : "");
      const preview = previewText.length > 160 ? `${previewText.slice(0, 160)}…` : previewText;
      const link = `${origin}/uz/messages/${conversationId}`;
      // Respect the recipient's notification preferences.
      if (other.notifyTelegram && other.telegramId) {
        // Bot-native quick reply: send a tracked message and remember its id → this
        // conversation. If the user swipe-replies in Telegram, the webhook posts
        // their text straight back here (no app switch). Hint that in the text.
        const tgId = other.telegramId;
        void tgSendTracked(
          tgId,
          `💬 Yangi xabar${ctx}\n\n${preview}\n\n↩️ Javob berish uchun shu xabarga reply qiling yoki oching:\n${link}`
        ).then((messageId) => {
          if (messageId == null) return;
          return prisma.telegramReplyTarget
            .create({ data: { telegramId: tgId, messageId: BigInt(messageId), conversationId } })
            .catch(() => {});
        });
      }
      if (other.notifyEmail && other.email) {
        const { text, html } = renderBrandedEmail({
          title: `New message${ctx}`,
          lines: [preview],
          button: { label: "Open conversation", url: link },
        });
        void sendEmail(other.email, `New message${ctx}`, text, html);
      }
      // In-app notification (always, independent of Telegram/email prefs).
      await notify(otherId, "message.new", `Yangi xabar${ctx}`, {
        body: preview,
        link: `/messages/${conversationId}`,
      });
    }
  }
  return message;
}

/**
 * Bot-native quick reply. A user swipe-replied in Telegram to one of our "new
 * message" notifications; map reply_to_message.message_id → conversation and post
 * their text as a real platform message (reusing the full authz + contact-stripping
 * + notify path). Returns the conversationId if routed, else null.
 */
export async function routeTelegramReply(
  telegramId: string,
  replyToMessageId: number,
  text: string
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const target = await prisma.telegramReplyTarget.findUnique({
    where: { telegramId_messageId: { telegramId, messageId: BigInt(replyToMessageId) } },
  });
  if (!target) return null;
  // The replier must be a real, active user linked to this Telegram id.
  const user = await prisma.user.findFirst({ where: { telegramId, status: "ACTIVE" } });
  if (!user) return null;
  // postConversationMessage re-checks that the user is a participant (404 otherwise),
  // so a stale/forged mapping can't post into a conversation they don't belong to.
  await postConversationMessage(target.conversationId, user, trimmed);
  return target.conversationId;
}

/** Mark all messages from the other party in a conversation as read. */
export async function markConversationRead(conversationId: string, user: Pick<User, "id" | "role">) {
  await authzConversation(conversationId, user);
  await prisma.message.updateMany({
    where: { conversationId, readAt: null, NOT: { senderId: user.id } },
    data: { readAt: new Date() },
  });
}

export interface InboxRow {
  id: string;
  counterpart: string;
  context: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

/** Conversations the user participates in (direct or via order), newest activity first. */
export async function listInbox(user: Pick<User, "id">): Promise<InboxRow[]> {
  const convos = await prisma.conversation.findMany({
    where: {
      OR: [
        { buyerId: user.id },
        { sellerId: user.id },
        { order: { buyerId: user.id } },
        { order: { sellerId: user.id } },
      ],
    },
    include: {
      buyer: NAME_SELECT,
      seller: NAME_SELECT,
      gig: { select: { title: true } },
      order: {
        select: { buyerId: true, sellerId: true, buyer: NAME_SELECT, seller: NAME_SELECT, gig: { select: { title: true } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { readAt: null, NOT: { senderId: user.id } } } } },
    },
    take: 50,
  });

  const rows = convos.map((c): InboxRow => {
    const buyerId = c.order?.buyerId ?? c.buyerId;
    const counterpartUser =
      user.id === buyerId ? c.order?.seller ?? c.seller : c.order?.buyer ?? c.buyer;
    const last = c.messages[0];
    return {
      id: c.id,
      counterpart: nameOf(counterpartUser),
      context: c.order?.gig?.title ?? c.gig?.title ?? "",
      lastBody: last?.body ?? null,
      lastAt: last ? last.createdAt.toISOString() : null,
      unread: c._count.messages,
    };
  });

  rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return rows;
}
