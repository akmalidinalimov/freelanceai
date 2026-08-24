import { Link } from "@/i18n/navigation";

/**
 * Abstract, brand-owned category bento (founder-approved "c2f", 2026-07-09).
 * No stock photos, no generic icons — a cohesive abstract mark set on warm
 * refraction fields. The first (flagship) tile is large and carries a slow
 * living refraction (CSS `home-abdrift`); everything else is static. Each tile
 * links to the gigs for that specialization (not creators).
 */

// Cohesive abstract marks (not literal icons): discs, broken orbit, nested arcs,
// twin lenses, flowing waves, swirl. Layered via currentColor + opacity.
const GLYPH = [
  `<circle cx="26" cy="32" r="14" fill="currentColor" opacity=".85"/><circle cx="42" cy="32" r="11" fill="currentColor" opacity=".4"/>`,
  `<circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="66 44" opacity=".75"/><circle cx="32" cy="15" r="5" fill="currentColor"/>`,
  `<circle cx="32" cy="32" r="8" fill="currentColor" opacity=".9"/><path d="M32 13a19 19 0 0 1 0 38" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" opacity=".45"/><path d="M32 21a11 11 0 0 0 0 22" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" opacity=".7"/>`,
  `<ellipse cx="27" cy="32" rx="11" ry="16" fill="currentColor" opacity=".55"/><ellipse cx="37" cy="32" rx="11" ry="16" fill="currentColor" opacity=".4"/>`,
  `<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"><path d="M15 25c9-9 25-9 34 0" opacity=".4"/><path d="M15 33c9-9 25-9 34 0"/><path d="M15 41c9-9 25-9 34 0" opacity=".6"/></g>`,
  `<path d="M44 22a15 15 0 1 0 5 11" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" opacity=".75"/><circle cx="44" cy="22" r="5" fill="currentColor"/>`,
];

export interface HomeCategory {
  href: string;
  name: string;
  sub: string;
}

export function AbstractCategories({ cats }: { cats: HomeCategory[] }) {
  return (
    <div className="home-bento">
      {cats.slice(0, 6).map((c, i) => (
        <Link key={c.href} href={c.href} className={`home-cat c${i + 1}${i === 0 ? " big" : ""}`}>
          <span className="home-cat-field" aria-hidden="true" />
          <span
            className="home-cat-ic"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 64 64">${GLYPH[i]}</svg>` }}
          />
          <span className="home-cat-name">
            {c.name}
            <span className="home-cat-sub">{c.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
