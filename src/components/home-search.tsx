"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";

/**
 * Homepage AI-search hero. Submits a plain GET form to /[locale]/search so it works
 * without JS; the typewriter placeholder + example chips are progressive enhancement.
 */
export function HomeSearch() {
  const t = useTranslations("Home");
  const locale = useLocale();
  const examples = [t("searchEx1"), t("searchEx2"), t("searchEx3"), t("searchEx4")];
  const staticPh = t("searchPlaceholder");
  const [ph, setPh] = useState(staticPh);
  const stop = useRef(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const prefix = t("searchExamplePrefix");
    let ei = 0;
    let ci = 0;
    let del = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (stop.current) return;
      const s = prefix + examples[ei];
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
          ei = (ei + 1) % examples.length;
          ci = prefix.length;
        }
      }
      timer = setTimeout(tick, del ? 25 : 52);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form action={`/${locale}/search`} method="get" className="w-full max-w-2xl">
      <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-left shadow-[0_30px_60px_-40px_rgba(11,21,38,0.35)] transition-colors focus-within:border-[hsl(var(--primary))]">
        <div className="flex items-center gap-2 px-2 pt-1 text-xs font-bold text-[hsl(var(--primary))]">
          <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
          {t("searchAssistant")}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            name="q"
            required
            maxLength={300}
            autoComplete="off"
            onFocus={() => {
              stop.current = true;
              setPh(staticPh);
            }}
            placeholder={ph}
            aria-label={staticPh}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none"
          />
          <button
            type="submit"
            aria-label={t("searchButton")}
            className="shrink-0 rounded-2xl bg-[hsl(var(--primary))] px-4 py-2.5 text-lg font-bold text-[hsl(var(--primary-foreground))] transition-transform active:scale-95"
          >
            →
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {examples.map((ex) => (
          <a
            key={ex}
            href={`/${locale}/search?q=${encodeURIComponent(ex)}`}
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]"
          >
            {ex}
          </a>
        ))}
      </div>
    </form>
  );
}
