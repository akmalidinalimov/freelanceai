"use client";

import { useEffect, useState } from "react";

type Row = { label: string; value: string; ok: boolean | null };

export function TgDebugClient() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Poll briefly: telegram-web-app.js is loaded by the bootstrap and may land after we mount.
    let tries = 0;
    const tick = async () => {
      tries += 1;
      const wa = (window as unknown as { Telegram?: { WebApp?: Record<string, unknown> } }).Telegram?.WebApp;
      const initData = (wa?.initData as string) ?? "";
      // Telegram puts initData in the URL fragment; if the SDK has none, say whether the raw
      // fragment did — that separates "Telegram never sent it" from "we lost it in a redirect".
      const rawFrag = window.location.hash.includes("tgWebAppData");

      let authAge = "n/a";
      if (initData) {
        const d = Number(new URLSearchParams(initData).get("auth_date"));
        if (d) authAge = `${Math.round(Date.now() / 1000 - d)}s old`;
      }

      let session = "checking...";
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const j = await r.json();
        session = j?.user?.id ? "SIGNED IN" : "signed out";
      } catch {
        session = "session check failed";
      }

      // Ask the server WHICH check fails. NextAuth collapses every authorize() failure into one
      // opaque "CredentialsSignin", so this is the only way to tell an HMAC mismatch from a stale
      // auth_date from a malformed user payload.
      let verify = "not attempted";
      if (initData) {
        try {
          const vr = await fetch("/api/telegram/initdata-debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });
          const v = await vr.json();
          verify = vr.ok
            ? [
                `verifier ${v.verifierAccepts ? "ACCEPTS" : "REJECTS"}`,
                `account ${v.accountExists ? (v.accountStatus ?? "?") : "MISSING"}`,
                `wouldSignIn ${v.wouldSignIn ? "YES" : "NO"}`,
                `hash ${v.hashMatches ? "OK" : "MISMATCH"}`,
                `fresh ${v.freshWithin600s ? "OK" : "NO"}`,
              ].join(" · ")
            : `${vr.status}: ${v.error ?? "error"}`;
        } catch {
          verify = "request failed";
        }
      }

      const next: Row[] = [
        { label: "initData present", value: initData ? `yes (${initData.length} chars)` : "NO — this is the problem", ok: Boolean(initData) },
        { label: "initData age", value: authAge, ok: authAge === "n/a" ? null : Number(authAge.replace(/\D/g, "")) < 600 },
        { label: "raw #tgWebAppData in URL", value: rawFrag ? "yes" : "no", ok: rawFrag },
        { label: "marker cookie", value: document.cookie.includes("gigora_tgapp") ? "yes" : "no", ok: document.cookie.includes("gigora_tgapp") },
        { label: "session", value: session, ok: session === "SIGNED IN" },
        { label: "server verify", value: verify, ok: verify.includes("wouldSignIn YES") },
        { label: "platform", value: String(wa?.platform ?? "unknown"), ok: null },
        { label: "Telegram version", value: String(wa?.version ?? "unknown"), ok: null },
        { label: "SDK loaded", value: wa ? "yes" : "no", ok: Boolean(wa) },
        { label: "URL", value: window.location.href.split("#")[0], ok: null },
      ];
      if (!cancelled) setRows(next);
      if (!wa && tries < 10) setTimeout(tick, 400);
    };
    void tick();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">Telegram launch diagnostic</h1>
      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        Screenshot this whole screen and send it back.
      </p>
      <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-3 py-2 last:border-b-0">
            <span className="shrink-0 text-sm text-[hsl(var(--muted-foreground))]">{r.label}</span>
            <span className={`break-all text-right text-sm font-medium ${r.ok === null ? "" : r.ok ? "text-green-600" : "text-red-600"}`}>
              {r.value}
            </span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-4 text-sm">reading…</div>}
      </div>
    </div>
  );
}
