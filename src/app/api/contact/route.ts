import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOrCreateDirectConversation } from "@/server/services/message";

const schema = z.object({ gigId: z.string().min(1) }).strict();

/** Start (or reopen) a direct conversation with a gig's seller. Returns the conversation id. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  const gig = await prisma.gig.findFirst({
    where: { id: body.gigId, status: "ACTIVE" },
    select: { sellerId: true },
  });
  if (!gig) throw Errors.notFound("Gig not found");
  const conversationId = await getOrCreateDirectConversation(user.id, gig.sellerId, body.gigId);
  return ok({ conversationId });
});
