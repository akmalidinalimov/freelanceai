"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export interface Msg {
  id: string;
  body: string | null;
  senderId: string;
  sender: { firstName: string | null; name: string | null; username: string | null };
  createdAt: string;
}

function senderName(m: Msg) {
  return m.sender.firstName ?? m.sender.name ?? m.sender.username ?? "";
}

export function MessageThread({
  orderId,
  currentUserId,
  initial,
}: {
  orderId: string;
  currentUserId: string;
  initial: Msg[];
}) {
  const t = useTranslations("Message");
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string>>(new Set(initial.map((m) => m.id)));
  const endRef = useRef<HTMLDivElement>(null);

  function append(incoming: Msg[]) {
    const fresh = incoming.filter((m) => !seen.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => [...prev, ...fresh]);
  }

  // Poll for new messages every 5s.
  useEffect(() => {
    const tick = async () => {
      const last = messages[messages.length - 1]?.createdAt;
      try {
        const r = await fetch(
          `/api/orders/${orderId}/messages${last ? `?after=${encodeURIComponent(last)}` : ""}`
        );
        const j = await r.json();
        if (j.ok) append(j.data.messages);
      } catch {
        /* ignore transient poll errors */
      }
    };
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [orderId, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await r.json();
      if (j.ok) {
        append([j.data.message]);
        setInput("");
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
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
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
        <Button onClick={send} disabled={busy || !input.trim()}>
          {t("send")}
        </Button>
      </div>
    </div>
  );
}
