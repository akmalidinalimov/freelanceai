import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Stars } from "@/components/stars";

/**
 * Instagram-style profile header for the seller's own profile page: the avatar (with
 * the camera badge that opens the picker), identity, level + XP progress, and the
 * stat row that makes the storefront feel like a profile instead of a settings form.
 * The avatar picker itself lives below in AvatarUpload (client) — this is the frame.
 */
export async function ProfileHero({
  name,
  username,
  headline,
  avatar,
  level,
  xp,
  xpNextAt,
  gigs,
  orders,
  ratingAvg,
  ratingCount,
  clients,
}: {
  name: string;
  username: string | null;
  headline: string | null;
  avatar: React.ReactNode;
  level: string;
  xp: number;
  xpNextAt: number | null;
  gigs: number;
  orders: number;
  ratingAvg: number;
  ratingCount: number;
  clients: number;
}) {
  const t = await getTranslations("Profile");
  const pct = xpNextAt && xpNextAt > 0 ? Math.min(100, Math.round((xp / xpNextAt) * 100)) : 100;

  const tile = (label: string, value: React.ReactNode) => (
    <div className="flex-1 px-2 py-2.5 text-center">
      <p className="text-lg font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
    </div>
  );

  return (
    <section className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col items-center text-center">
        {/* Avatar + camera badge (the badge is part of AvatarUpload, passed in) */}
        <div className="relative">{avatar}</div>

        <span className="mt-3 rounded-full bg-[hsl(var(--primary))] px-2.5 py-0.5 text-[11px] font-bold text-[hsl(var(--primary-foreground))]">
          {level}
        </span>

        <h1 className="mt-2 text-xl font-extrabold">{name}</h1>
        {username && (
          <Link
            href={`/creators/${username}`}
            className="text-sm text-[hsl(var(--primary-ink))] hover:underline"
          >
            gigora.ai/@{username}
          </Link>
        )}
        <p className="mt-1 max-w-md text-sm text-[hsl(var(--muted-foreground))]">
          {headline || t("noHeadlineYet")}
        </p>
      </div>

      {/* Stat row */}
      <div className="mt-4 flex divide-x divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))]">
        {tile(t("statGigs"), gigs)}
        {tile(t("statOrders"), orders)}
        {tile(t("statClients"), clients)}
        {tile(
          t("statRating"),
          ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              {ratingAvg.toFixed(1)}
              <Stars value={ratingAvg} />
            </span>
          ) : (
            "—"
          )
        )}
      </div>

      {/* XP progress toward the next level */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="tabular-nums">{xp} XP</span>
          {xpNextAt && <span className="tabular-nums">{t("nextLevelAt", { xp: xpNextAt })}</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
