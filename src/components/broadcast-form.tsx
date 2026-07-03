"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const AUDIENCES = [
  { value: "ALL", label: "All bot users" },
  { value: "BUYERS", label: "Buyers only" },
  { value: "SELLERS", label: "Sellers only" },
  { value: "ACTIVE_30D", label: "Active in last 30 days" },
] as const;

/** Admin composer: message + audience → queues a throttled Telegram broadcast. */
export function BroadcastForm() {
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<string>("ALL");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3 || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), audience }),
      });
      const j = await res.json();
      if (j.ok) {
        setState("done");
        setResult(`Queued to ~${j.data.recipients} recipients. Sending now (throttled).`);
        setMessage("");
      } else {
        setState("error");
        setResult(j.error?.message ?? "Failed");
      }
    } catch {
      setState("error");
      setResult("Network error");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[hsl(var(--border))] p-4">
      <label className="block text-sm font-medium" htmlFor="bc-msg">
        Message (Telegram)
      </label>
      <textarea
        id="bc-msg"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={3000}
        placeholder="Написать всем пользователям бота…"
        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Queuing…" : "Send broadcast"}
        </Button>
        {result && (
          <span className={`text-sm ${state === "error" ? "text-red-700" : "text-emerald-700"}`}>{result}</span>
        )}
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Only reaches users who linked Telegram, have Telegram notifications on, and haven&apos;t
        blocked the bot. Delivery is throttled (Telegram limits) and resumes automatically.
      </p>
    </form>
  );
}
