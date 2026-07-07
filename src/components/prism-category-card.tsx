import { Link } from "@/i18n/navigation";

/**
 * Prism category tile — the founder-chosen category design (design-cat-pattern
 * Pattern A "Diagonal Sweep" + the approved zipper type). One shared prism
 * photograph, varied per tile by crop / mirror / hue so eight tiles read as a
 * family, not clones. The zipper word is a brand graphic (same across locales);
 * the accessible name and the bottom pill carry the localized text.
 *
 * DARK variant (D02 homepage): the same diagonal prism-refraction art, but the
 * spectrum glows against a near-black ground so the tiles belong to the dark
 * blueprint world instead of reading as a leftover cream block. This uses its
 * own versioned dark asset — the cream `pattern-sweep-v2.webp` stays the
 * universal light-surface cover fallback elsewhere and is untouched.
 */

/** Per-tile art variation: [objectPosition, flip, hueRotate(deg)] */
const VARIANTS: [string, boolean, number][] = [
  ["50% 50%", false, 0],
  ["50% 50%", true, 14],
  ["50% 12%", false, -16],
  ["50% 88%", false, 0],
  ["50% 50%", true, -16],
  ["50% 30%", false, 26],
  ["50% 12%", true, 0],
  ["50% 88%", false, 14],
];

export function PrismCategoryCard({
  href,
  word,
  label,
  sub,
  index,
}: {
  href: string;
  /** brand-graphic display word, e.g. "AI VIDEO" (kept identical across locales) */
  word: string;
  /** localized category name — becomes the accessible name */
  label: string;
  /** localized short descriptor for the bottom pill */
  sub: string;
  /** position in the grid — picks the art variation */
  index: number;
}) {
  const [pos, flip, hue] = VARIANTS[index % VARIANTS.length];
  const letters = word.split("");
  let beat = 0; // alternates up/down across non-space characters

  return (
    <Link
      href={href}
      aria-label={label}
      className="prism-tile group relative isolate block aspect-[3/4] overflow-hidden rounded-2xl bg-[#0a0c12] shadow-[0_2px_6px_rgba(0,0,0,.5),0_16px_44px_-16px_rgba(0,0,0,.7)] ring-1 ring-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      style={{ ["--tile-flip" as string]: flip ? "scaleX(-1)" : "scaleX(1)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative art, single shared asset */}
      <img
        src="/prism/pattern-sweep-dark-v1.webp"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: pos,
          transform: flip ? "scaleX(-1)" : undefined,
          filter: `brightness(1.04) contrast(1.08) saturate(1.12)${hue ? ` hue-rotate(${hue}deg)` : ""}`,
        }}
      />
      {/* readability scrim under the word only */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[28%] z-[2] h-[46%]"
        style={{ background: "radial-gradient(72% 100% at 50% 50%, rgba(5,7,12,.5), transparent 76%)" }}
      />
      {/* the zipper word */}
      <span
        aria-hidden
        className="font-display pointer-events-none absolute inset-x-0 top-[44%] z-[3] flex items-baseline justify-center font-bold leading-none text-white"
        style={{ textShadow: "0 2px 18px hsl(20 20% 10% / .35)" }}
      >
        {letters.map((ch, i) =>
          ch === " " ? (
            <span key={i} className="w-[0.32em]" />
          ) : (
            <span
              key={i}
              className={`inline-block ${beat++ % 2 === 0 ? "zip-up" : "zip-down"}`}
              style={{ fontSize: "clamp(1.15rem, 15cqw, 2.6rem)" }}
            >
              {ch}
            </span>
          )
        )}
      </span>
      {/* poster meta pills */}
      <span
        aria-hidden
        className="absolute left-1/2 top-[5.5%] z-[4] -translate-x-1/2 whitespace-nowrap rounded-full border-[1.5px] border-white/85 bg-[hsl(20_15%_10%/.16)] px-3 py-1 text-[.55rem] font-extrabold tracking-[.14em] text-white backdrop-blur-[3px]"
      >
        GIGORA
      </span>
      <span
        aria-hidden
        className="absolute bottom-[5%] left-1/2 z-[4] -translate-x-1/2 whitespace-nowrap rounded-full bg-[hsl(20_15%_8%/.9)] px-3.5 py-1.5 text-[.55rem] font-extrabold uppercase tracking-[.14em] text-white"
      >
        {sub}
      </span>
      {/* film grain unifies the set */}
      <span aria-hidden className="prism-grain pointer-events-none absolute inset-0 z-[5]" />
    </Link>
  );
}
