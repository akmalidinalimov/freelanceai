import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { listMessages, postMessage } from "@/server/services/message";

/** Poll messages for an order (optionally only those after ?after=<ISO>). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const after = new URL(request.url).searchParams.get("after") ?? undefined;
    const messages = await listMessages(id, user, after);
    return ok({ messages });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({ body: z.string().min(1).max(2000) }).strict();

/** Send a message on an order. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    if (!rateLimit(`msg:${clientIp(request)}`, 30, 60_000)) throw Errors.rateLimited();
    const { id } = await params;
    const input = parseInput(schema, await request.json().catch(() => ({})));
    const message = await postMessage(id, user, input.body);
    return ok({ message });
  } catch (err) {
    return errorResponse(err);
  }
}
