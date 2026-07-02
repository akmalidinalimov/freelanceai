import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { keyFromPublicUrl } from "@/lib/media";
import { listConversationMessages, postConversationMessage } from "@/server/services/message";

/** Poll messages in a conversation (optionally only those after ?after=<ISO>). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const after = new URL(request.url).searchParams.get("after") ?? undefined;
    const messages = await listConversationMessages(id, user, after);
    return ok({ messages });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z
  .object({
    body: z.string().max(2000).optional(),
    fileUrls: z.array(z.string().url()).max(5).optional(),
  })
  .strict()
  .refine((d) => (d.body && d.body.trim()) || (d.fileUrls && d.fileUrls.length > 0), {
    message: "Message is empty",
  });

/** Send a message in a conversation. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    enforceRateLimit(`msg:${clientIp(request)}`, 30, 60_000);
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    // Only accept attachments that are our own R2 uploads — never arbitrary external URLs
    // (which would be a stored phishing / IP-tracking / SSRF vector when rendered).
    if (input.fileUrls?.some((u) => keyFromPublicUrl(u) === null)) {
      throw Errors.validation({ fileUrls: "Only uploaded files are allowed" });
    }
    const message = await postConversationMessage(id, user, input.body ?? "", input.fileUrls ?? []);
    return ok({ message });
  } catch (err) {
    return errorResponse(err);
  }
}
