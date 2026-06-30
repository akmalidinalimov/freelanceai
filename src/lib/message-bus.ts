import "server-only";
import { EventEmitter } from "events";

/**
 * In-process pub/sub for realtime message delivery (SSE). Works on the single app
 * instance we run today; scaling to multiple instances later swaps this for Redis
 * pub/sub behind the same publish/subscribe API. Survives Next hot-reload via globalThis.
 */
const g = globalThis as unknown as { __msgBus?: EventEmitter };
const bus = g.__msgBus ?? (g.__msgBus = new EventEmitter());
bus.setMaxListeners(0); // many concurrent SSE subscribers

export interface BusMessage {
  id: string;
  conversationId: string;
  body: string | null;
  senderId: string;
  sender: { firstName: string | null; name: string | null; username: string | null };
  createdAt: string;
}

const channel = (conversationId: string) => `conv:${conversationId}`;

export function publishMessage(m: BusMessage): void {
  bus.emit(channel(m.conversationId), m);
}

export function subscribeMessages(conversationId: string, cb: (m: BusMessage) => void): () => void {
  const ch = channel(conversationId);
  bus.on(ch, cb);
  return () => bus.off(ch, cb);
}
