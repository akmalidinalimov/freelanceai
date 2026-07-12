"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";
import { isOnline } from "@/lib/presence";

export interface Msg {
  id: string;
  body: string | null;
  fileUrls?: string[];
  senderId: string;
  sender: { firstName: string | null; name: string | null; username: string | null };
  createdAt: string;
  /** When the counterpart read this message (for read ticks on my own messages). */
  readAt?: string | null;
}

const isVideo = (u: string) => /\.(mp4|webm)$/i.test(u);
const REDACTION = "[hidden]";

function senderName(m: Msg) {
  return m.sender.firstName ?? m.sender.name ?? m.sender.username ?? "";
}
const dayKey = (iso: string) => new Date(iso).toDateString();

export function MessageThread({
  conversationId,
  currentUserId,
  initial,
  counterpart,
  initiallyBlocked = false,
}: {
  conversationId: string;
  currentUserId: string;
  initial: Msg[];
  counterpart?: { name: string; lastSeenAt: string | null } | null;
  initiallyBlocked?: boolean;
}) {
  const t = useTranslations("Message");
  const format = useFormatter();
  const lastSeenMs = counterpart?.lastSeenAt ? new Date(counterpart.lastSeenAt).getTime() : null;
  const quickReplies = (t.raw("quickReplies") as string[]) ?? [];
  // Presence depends on the current clock, which differs between SSR and hydration —
  // render it only after mount (client-only) to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const online = mounted && isOnline(lastSeenMs, Date.now());

  // Block / report state (T&S). Server enforces block on send; UI reflects + disables.
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [tsBusy, setTsBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reported, setReported] = useState(false);

  async function toggleBlock() {
    if (tsBusy) return;
    setTsBusy(true);
    try {
      const r = await fetch(`/api/conversations/${conversationId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await r.json();
      if (j.ok) setBlocked(j.data.blocked);
      else setSendError(j.error?.message ?? t("actionFailed"));
    } catch {
      setSendError(t("actionFailed"));
    } finally {
      setTsBusy(false);
    }
  }

  async function submitReport() {
    const reason = reportReason.trim();
    if (reason.length < 3 || tsBusy) return;
    setTsBusy(true);
    try {
      const r = await fetch(`/api/conversations/${conversationId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (j.ok) {
        setReported(true);
        setReporting(false);
        setReportReason("");
      } else setSendError(j.error?.message ?? t("actionFailed"));
    } catch {
      setSendError(t("actionFailed"));
    } finally {
      setTsBusy(false);
    }
  }
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set(initial.map((m) => m.id)));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setSendError(null);
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
      } else {
        setSendError(j.error?.message ?? t("sendFailed"));
      }
    } catch {
      setSendError(t("sendFailed"));
    } finally {
      setBusy(false);
    }
  }

  function dayLabel(iso: string) {
    const k = dayKey(iso);
    const now = new Date();
    if (k === now.toDateString()) return t("today");
    if (k === new Date(now.getTime() - 86_400_000).toDateString()) return t("yesterday");
    return format.dateTime(new Date(iso), { day: "numeric", month: "short" });
  }

  return (
    <div className="flex flex-col">
      {/* Header — presence + T&S controls */}
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{counterpart?.name || t("title")}</p>
          {counterpart && mounted && (
            <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${online ? "bg-emerald-600" : "bg-[hsl(var(--muted-foreground))]/40"}`}
              />
              {online
                ? t("online")
                : lastSeenMs
                  ? t("lastSeen", { time: format.relativeTime(new Date(lastSeenMs)) })
                  : t("offline")}
            </span>
          )}
        </div>
        {counterpart && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setReporting((v) => !v)}
              aria-expanded={reporting}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
            >
              {reported ? t("reported") : t("report")}
            </button>
            <button
              type="button"
              onClick={toggleBlock}
              disabled={tsBusy}
              className="text-[hsl(var(--muted-foreground))] hover:text-red-700 hover:underline disabled:opacity-50"
            >
              {blocked ? t("unblock") : t("block")}
            </button>
          </div>
        )}
      </div>

      {/* Escrow / protection strip — loss-framed, not accusatory. Inbox-context only
          (a counterpart is set on the Messages page; the order page embeds the thread
          without one and carries its own trust context). */}
      {counterpart && (
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--success-soft))] px-4 py-2 text-[11.5px] font-medium text-[hsl(var(--success))]">
          <span aria-hidden>🛡</span>
          {t("escrowStrip")}
        </div>
      )}

      {reporting && !reported && (
        <div className="space-y-2 border-b border-[hsl(var(--border))] p-3">
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t("reportPlaceholder")}
            aria-label={t("report")}
            className="w-full rounded-md border border-[hsl(var(--input-border))] bg-transparent p-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReporting(false)}>
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={submitReport} disabled={tsBusy || reportReason.trim().length < 3}>
              {t("reportSubmit")}
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex min-h-[320px] flex-col gap-0.5 overflow-y-auto bg-[hsl(var(--surface-2))]/30 px-4 py-3"
        style={{ maxHeight: "min(60vh, 620px)" }}
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === currentUserId;
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            // Group on sender only (tz-independent); the divider carries the day break.
            const grouped = prev?.senderId === m.senderId;
            const redacted = m.body?.includes(REDACTION);
            return (
              <div key={m.id}>
                {/* Day computation uses the local calendar day, which differs between the
                    SSR (server tz) and client render — gate it behind mount to avoid a
                    hydration mismatch near midnight. */}
                {mounted && newDay && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-0.5 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm ${
                      mine
                        ? "rounded-2xl rounded-br-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "rounded-2xl rounded-bl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                    }`}
                  >
                    {!mine && !grouped && <p className="mb-0.5 text-xs opacity-70">{senderName(m)}</p>}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.fileUrls && m.fileUrls.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.fileUrls.map((u) => {
                          // Chat files live in the private bucket — always fetch through the
                          // access-controlled proxy (also resolves legacy public-URL messages).
                          const src = `/api/conversations/${conversationId}/file?u=${encodeURIComponent(u)}`;
                          return (
                            <a key={u} href={src} target="_blank" rel="noreferrer" aria-label={t("attachment")}>
                              {isVideo(u) ? (
                                <span
                                  aria-hidden
                                  className="flex h-16 w-16 items-center justify-center rounded bg-black/20 text-lg"
                                >
                                  ▶
                                </span>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={src} alt={t("attachment")} loading="lazy" className="h-16 w-16 rounded object-cover" />
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {redacted && (
                      <p
                        className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-[hsl(var(--warning))]"}`}
                        title={t("filteredWhy")}
                      >
                        🛈 {t("filteredNote")}
                      </p>
                    )}
                    <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/80" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {mounted && format.dateTime(new Date(m.createdAt), { hour: "2-digit", minute: "2-digit" })}
                      {/* Read ticks only in the Messages inbox context (order page passes no counterpart). */}
                      {mine && counterpart && <span aria-hidden>{m.readAt ? "✓✓" : "✓"}</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-[hsl(var(--border))] px-3 pb-3 pt-2">
        {quickReplies.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="shrink-0 whitespace-nowrap rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--primary))]/[0.06] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-ink))]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="mb-2">
          <GalleryUpload value={files} onChange={setFiles} prefix="messages" video label={t("attach")} />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="h-10 flex-1 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm"
          />
          <Button onClick={send} disabled={busy || (!input.trim() && files.length === 0)}>
            {t("send")}
          </Button>
        </div>
        {sendError && (
          <p className="mt-2 text-sm text-[hsl(var(--danger))]" role="alert">
            {sendError}
          </p>
        )}
      </div>
    </div>
  );
}
