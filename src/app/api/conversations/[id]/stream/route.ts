import { getCurrentUser } from "@/lib/session";
import { canAccessConversation } from "@/server/services/message";
import { subscribeMessages, type BusMessage } from "@/lib/message-bus";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream of new messages in a conversation. Replaces client
 * polling: the browser opens one EventSource and the server pushes each new
 * message as it's posted (via the in-process message bus). A 25s heartbeat keeps
 * the connection alive through the Cloudflare tunnel; clients still keep a slow
 * fallback poll in case the stream is buffered.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  // Cap new stream opens per user — an EventSource holds an open connection + heartbeat,
  // so without a ceiling one user could exhaust listeners/timers by opening thousands.
  if (!rateLimit(`stream:${user.id}`, 30, 60_000)) return new Response("rate limited", { status: 429 });
  const { id } = await params;
  if (!(await canAccessConversation(id, user))) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* stream already closed */
        }
      };
      enqueue(": connected\n\n");

      const onMessage = (m: BusMessage) => enqueue(`data: ${JSON.stringify(m)}\n\n`);
      unsubscribe = subscribeMessages(id, onMessage);
      heartbeat = setInterval(() => enqueue(": ping\n\n"), 25000);

      const close = () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
