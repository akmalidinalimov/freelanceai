"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Passwordless email login: posts the address to /api/auth/email/request, which sends
 * a magic link. Always shows the same "check your inbox" success (the API never reveals
 * whether the address exists), so this form can't be used to enumerate accounts.
 */
export function EmailLoginForm({ locale }: { locale: string }) {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p
        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3 text-sm text-[hsl(var(--foreground))]"
        role="status"
      >
        {t("emailSent")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-2 text-left">
      <label htmlFor="email-login" className="sr-only">
        {t("emailLabel")}
      </label>
      <input
        id="email-login"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        placeholder={t("emailPlaceholder")}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      />
      {state === "error" && (
        <p className="text-sm text-[hsl(var(--danger))]" role="alert">
          {t("emailError")}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? t("emailSending") : t("emailBtn")}
      </Button>
    </form>
  );
}
