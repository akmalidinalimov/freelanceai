"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";

export interface Msg {
  id: string;
  body: string | null;
  fileUrls?: string[];
  senderId: string;
  sender: { firstName: string | null; name: string | null; username: string | null };
  createdAt: string;
}

const isVideo = (u: string) => /\.(mp4|webm)$/i.test(u);

function senderName(m: Msg) {
  return m.sender.firstName ?? m.sender.name ?? m.sender.username ?? "";
}

export function MessageThread({
  conversationId,
  currentUserId,
  initial,
}: {
  conversationId: string;
  currentUserId: string;
  initial: Msg[];
}) {
  const t = useTranslations("Message");
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string>>(new Set(initial.map((m) => m.id)));
  const endRef = useRef<HTMLDivElement>(null);

  function append(incoming: Msg[]) {
    const fresh = incoming.filter((m) => !seen.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => [...prev, ...fresh]);
  }

  // Realtime: subscribe to the conversation's SSE stream; new messages arrive instantly.
  // EventSource auto-reconnects if the connection drops.
  useEffect(() => {
    const es = new EventSource(`/api/conversations/${conversationId}/stream`);
    es.onmessage = (e) => {
      try {
        append([JSON.parse(e.data) as Msg]);
      } catch {
        /* ignore malformed event */
      }
    };
    return () => es.close();
    // append is stable (uses refs + functional setState); only re-subscribe per conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Slow fallback poll (20s) — a safety net in case the SSE stream is buffered by a proxy.
  useEffect(() => {
    const tick = async () => {
      const last = messages[messages.length - 1]?.createdAt;
      try {
        const r = await fetch(
          `/api/conversations/${conversationId}/messages${last ? `?after=${encodeURIComponent(last)}` : ""}`
        );
        const j = await r.json();
        if (j.ok) append(j.data.messages);
      } catch {
        /* ignore transient poll errors */
      }
    };
    const interval = setInterval(tick, 20000);
    return () => clearInterval(interval);
  }, [conversationId, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if ((!body && files.length === 0) || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body || undefined, fileUrls: files }),
      });
      const j = await r.json();
      if (j.ok) {
        append([j.data.message]);
        setInput("");
        setFiles([]);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <p className="mb-3 text-sm font-medium">{t("title")}</p>

      <div className="mb-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-[hsl(var(--muted))]"
                  }`}
                >
                  {!mine && <p className="mb-0.5 text-xs opacity-70">{senderName(m)}</p>}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.fileUrls && m.fileUrls.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.fileUrls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          {isVideo(u) ? (
                            <span className="flex h-16 w-16 items-center justify-center rounded bg-black/20 text-lg">
                              ▶
                            </span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u} alt="" loading="lazy" className="h-16 w-16 rounded object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="mb-2">
        <GalleryUpload value={files} onChange={setFiles} prefix="messages" video label={t("attach")} />
      </div>
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t("placeholder")}
          className="h-10 flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm"
        />
        <Button onClick={send} disabled={busy || (!input.trim() && files.length === 0)}>
          {t("send")}
        </Button>
      </div>
    </div>
  );
}
