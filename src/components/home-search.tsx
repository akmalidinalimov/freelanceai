"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

interface MatchResult {
  sellerId: string;
  username: string | null;
  name: string;
  avatar: string | null;
  verified: boolean;
  level: string;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  matchedSpecs: string[];
  score: number;
}

const AV_GRADIENTS = [
  "radial-gradient(circle at 30% 30%,#f7b24a,#f0623c 60%,#8a2d5a)",
  "radial-gradient(circle at 55% 45%,#7ef0d0,#0f9e79,#0a3f4a)",
  "radial-gradient(circle at 40% 60%,#8ab4ff,#5b4ad0,#22143f)",
  "radial-gradient(circle at 45% 40%,#c9a2ff,#6d4ad0,#241146)",
  "radial-gradient(circle at 50% 35%,#ffb0c8,#f0623c,#5a1030)",
  "radial-gradient(circle at 35% 55%,#a0f0d8,#0f9e79,#053b2c)",
];
const gradFor = (s: string) =>
  AV_GRADIENTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_GRADIENTS.length];

/** Homepage AI-concierge search: typewriter placeholder, voice mic, and inline ranked
 *  results from the real /api/search/match — the B3 experience on live data. */
export function HomeSearch() {
  const t = useTranslations("Home");
  const ts = useTranslations("Search");
  const tp = useTranslations("Profile");
  const locale = useLocale();

  const [q, setQ] = useState("");
  const [ph, setPh] = useState(t("searchPlaceholder"));
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [specLabels, setSpecLabels] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const stopRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const examples = [
    t("searchEx1"),
    t("searchEx2"),
    t("searchEx3"),
    t("searchEx4"),
    t("searchEx5"),
  ];

  // typewriter placeholder, stops on focus
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return;
    const prefix = t("searchExamplePrefix");
    const ex = [t("searchEx1"), t("searchEx2"), t("searchEx3"), t("searchEx4"), t("searchEx5")];
    let ei = 0;
    let ci = 0;
    let del = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (stopRef.current) return;
      const s = prefix + ex[ei];
      setPh(s.slice(0, ci));
      if (!del) {
        ci++;
        if (ci > s.length) {
          del = true;
          timer = setTimeout(tick, 1500);
          return;
        }
      } else {
        ci--;
        if (ci < prefix.length) {
          del = false;
          ei = (ei + 1) % ex.length;
          ci = prefix.length;
        }
      }
      timer = setTimeout(tick, del ? 25 : 52);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(query: string) {
    const text = query.trim();
    if (!text) {
      taRef.current?.focus();
      return;
    }
    setState("loading");
    setResults([]);
    try {
      const r = await fetch("/api/search/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, locale, limit: 6 }),
      });
      const j = await r.json();
      if (j.ok) {
        setResults(j.data.results as MatchResult[]);
        setSpecLabels((j.data.intent?.specLabels as string[]) ?? []);
      }
    } catch {
      /* leave results empty */
    }
    setState("done");
  }

  // Drop the sentence into the box as an editable draft (don't auto-search) so the user
  // can tweak it before running — these are starting points, not one-tap searches.
  function pickExample(ex: string) {
    stopRef.current = true;
    setQ(ex);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });
  }

  function mic() {
    const SR =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    stopRef.current = true;
    if (SR) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (SR as any)();
      rec.lang = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
      rec.interimResults = false;
      setListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const txt = e.results?.[0]?.[0]?.transcript ?? "";
        setQ(txt);
        run(txt);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      try {
        rec.start();
      } catch {
        setListening(false);
      }
    } else {
      const demo = t("searchEx1");
      setQ(demo);
      run(demo);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-left shadow-[0_30px_60px_-40px_rgba(11,21,38,0.35)] transition-colors focus-within:border-[hsl(var(--primary))]"
      >
        <div className="flex items-center gap-2 px-2 pt-1 text-xs font-bold text-[hsl(var(--primary))]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
          {t("searchAssistant")}
        </div>
        <div className="mt-1 flex items-end gap-2">
          <textarea
            ref={taRef}
            value={q}
            rows={1}
            maxLength={300}
            onChange={(e) => {
              setQ(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
            }}
            onFocus={() => {
              stopRef.current = true;
              setPh(t("searchPlaceholder"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(q);
              }
            }}
            placeholder={ph}
            aria-label={t("searchPlaceholder")}
            className="min-h-[26px] flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none"
          />
          <button
            type="button"
            onClick={mic}
            aria-label={t("micLabel")}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg transition-transform active:scale-95 ${
              listening
                ? "animate-pulse border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                : "border-[hsl(var(--border))]"
            }`}
          >
            🎙
          </button>
          <button
            type="submit"
            aria-label={t("searchButton")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))] transition-transform active:scale-95 hover:bg-[hsl(var(--primary))]/90"
          >
            →
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => pickExample(ex)}
              className="shrink-0 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {state !== "idle" && (
        <div className="mt-4 text-left">
          {state === "loading" ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--primary))] [animation-delay:300ms]" />
                </span>
                {ts("thinking")}
              </div>
              <div className="grid gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-[hsl(var(--muted))]/60" />
                ))}
              </div>
            </>
          ) : results.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{ts("noResults")}</p>
          ) : (
            <>
              {specLabels.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                    {ts("understood")}:
                  </span>
                  {specLabels.map((l) => (
                    <span
                      key={l}
                      className="rounded-lg bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-xs font-bold text-[hsl(var(--primary))]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="font-display text-lg font-bold">
                  {ts("resultsCount", { count: results.length })}
                </h2>
                <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  {ts("match")}
                </span>
              </div>
              <div className="grid gap-3">
                {results.map((r) => {
                  const reason =
                    r.matchedSpecs.length > 0
                      ? ts("reasonSpecs", { specs: r.matchedSpecs.slice(0, 2).join(" + ") })
                      : ts("reasonGeneric");
                  const card = (
                    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]">
                      <div
                        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-2xl text-base font-bold text-white"
                        style={{ background: r.avatar ? undefined : gradFor(r.name) }}
                      >
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          r.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="truncate">{r.name}</span>
                          {r.verified && <span className="text-xs text-[hsl(var(--primary))]">✓</span>}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                          {reason}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2.5 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                          {r.ratingCount > 0 && (
                            <span>
                              ★ <b className="text-[hsl(var(--foreground))]">{r.ratingAvg.toFixed(1)}</b>
                            </span>
                          )}
                          <span>{tp(`level.${r.level}`)}</span>
                          {r.completedOrders > 0 && <span>{ts("orders", { count: r.completedOrders })}</span>}
                        </div>
                      </div>
                      <div
                        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(hsl(var(--primary)) ${r.score}%, hsl(var(--muted)) 0)`,
                        }}
                      >
                        <div className="absolute inset-1 rounded-full bg-[hsl(var(--card))]" />
                        <span className="relative text-xs font-extrabold text-[hsl(var(--primary))]">
                          {r.score}%
                        </span>
                      </div>
                    </div>
                  );
                  return r.username ? (
                    <Link key={r.sellerId} href={`/creators/${r.username}`}>
                      {card}
                    </Link>
                  ) : (
                    <div key={r.sellerId}>{card}</div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
