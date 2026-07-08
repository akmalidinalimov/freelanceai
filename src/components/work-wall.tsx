import { Link } from "@/i18n/navigation";

export interface WallGig {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverType: string | null;
  coverPosterUrl: string | null;
  coverFocal: string | null;
}

function Tile({ g }: { g: WallGig }) {
  const src = g.coverType === "video" ? g.coverPosterUrl ?? g.coverUrl : g.coverUrl;
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="group relative block h-[112px] w-[188px] shrink-0 overflow-hidden rounded-xl border border-[hsl(var(--border))] sm:h-[128px] sm:w-[220px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ?? "/prism/pattern-sweep-dark-wide-v1.webp"}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ objectPosition: g.coverFocal ?? "center" }}
      />
      {g.coverType === "video" && (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-[10px] text-white backdrop-blur-sm">
          ▶
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8">
        <span className="line-clamp-1 text-[11px] font-semibold text-white sm:text-xs">{g.title}</span>
      </span>
    </Link>
  );
}

/**
 * WorkWall — a bottom-of-homepage "living gallery": two rows of real gig covers scrolling
 * in opposite directions (marquee). Signals a busy marketplace of real work. Pure CSS
 * animation (no client JS); pauses under prefers-reduced-motion; edge-faded; overflow
 * contained so it can bleed full-width without triggering horizontal page scroll on mobile.
 */
export function WorkWall({ gigs, title }: { gigs: WallGig[]; title: string }) {
  if (gigs.length < 3) return null;
  const rowA = [...gigs, ...gigs];
  const rowB = (() => {
    const r = [...gigs].reverse();
    return [...r, ...r];
  })();
  return (
    <section aria-label={title} className="relative -mx-4 overflow-hidden py-8">
      <div className="mb-4 px-5 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        ✦ {title}
      </div>
      <div className="workwall-l flex w-max gap-3 px-3">
        {rowA.map((g, i) => (
          <Tile key={`a${i}`} g={g} />
        ))}
      </div>
      <div className="workwall-r mt-3 flex w-max gap-3 px-3">
        {rowB.map((g, i) => (
          <Tile key={`b${i}`} g={g} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[hsl(var(--background))] to-transparent sm:w-20" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[hsl(var(--background))] to-transparent sm:w-20" />
    </section>
  );
}
