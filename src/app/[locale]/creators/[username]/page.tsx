import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPublicProfile, getProvenSpecKeys } from "@/server/services/profile";
import { isFollowing } from "@/server/services/follow";
import { getCurrentUser } from "@/lib/session";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { FollowButton } from "@/components/follow-button";
import { ShareButton } from "@/components/share-button";
import { VerifiedBadge } from "@/components/verified-badge";
import { specLabel } from "@/lib/specializations";
import { badgeDef, badgeLabel } from "@/lib/badges";
import { getUserBadges } from "@/server/services/gamification";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfile(username).catch(() => null);
  if (!data) return {};
  const name = data.user.firstName ?? data.user.name ?? data.user.username ?? "";
  return {
    title: name,
    description: data.profile?.headline ?? `${name} — ${BRAND_NAME}`,
  };
}
import { formatUzs } from "@/lib/utils";
import { Stars } from "@/components/stars";
import { BRAND_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Profile");
  const tg = await getTranslations("Gig");
  const ti = await getTranslations("Instagram");

  const data = await getPublicProfile(username);
  if (!data) notFound();
  const { user, profile, gigs } = data;
  const earnedBadges = (await getUserBadges(user.id)).filter((b) => b.key.startsWith("seller_"));

  const name = user.firstName ?? user.name ?? user.username ?? "";
  const avatar = user.image ?? user.photoUrl ?? null;
  const memberYear = new Date(user.createdAt).getFullYear();

  const proven =
    (profile?.specializations?.length ?? 0) > 0
      ? await getProvenSpecKeys(user.id)
      : new Set<string>();

  const me = await getCurrentUser().catch(() => null);
  const viewer = !me ? "guest" : me.id === user.id ? "owner" : "buyer";
  const contactGigId = gigs[0]?.id;
  const following = me && viewer === "buyer" ? await isFollowing(me.id, user.id) : false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Identity card */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-2xl font-bold text-[hsl(var(--primary-ink))]">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{name}</h1>
            {profile && (
              <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-0.5 text-xs font-medium">
                {t(`level.${profile.level}`)}
              </span>
            )}
            {user.kycStatus === "VERIFIED" && <VerifiedBadge label={t("verified")} />}
            {viewer === "buyer" && <FollowButton sellerId={user.id} initialFollowing={following} />}
          </div>
          <div className="mt-2">
            <ShareButton path={`/${locale}/creators/${username}`} title={name} />
          </div>
          {profile && profile.ratingCount > 0 ? (
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Stars value={profile.ratingAvg} />
              <span className="font-medium tabular-nums">{profile.ratingAvg.toFixed(1)}</span>
              <span className="text-[hsl(var(--muted-foreground))]">({profile.ratingCount})</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t("noReviews")}</p>
          )}
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t("memberSince")} {memberYear}
          </p>
          {earnedBadges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {earnedBadges.map((b) => {
                const def = badgeDef(b.key);
                if (!def) return null;
                return (
                  <span
                    key={b.key}
                    className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-2 py-0.5 text-xs"
                  >
                    {def.emoji} {badgeLabel(b.key, locale)}
                  </span>
                );
              })}
            </div>
          )}
          {profile?.headline && <p className="mt-3 font-medium">{profile.headline}</p>}
          {profile?.instagramUsername && (
            <a
              href={`https://www.instagram.com/${profile.instagramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:border-[hsl(var(--primary))]"
            >
              <span
                aria-hidden
                className="inline-block h-3.5 w-3.5 rounded"
                style={{ background: "linear-gradient(45deg,#f7b24a,#f0623c,#c13584,#5b4ad0)" }}
              />
              Instagram · @{profile.instagramUsername}
            </a>
          )}
          {contactGigId && viewer !== "owner" && (
            <div className="mt-3">
              <ContactSellerButton gigId={contactGigId} locale={locale} viewer={viewer} />
            </div>
          )}
        </div>
      </div>

      {(profile?.specializations?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 font-semibold">{t("specializations")}</h2>
          <div className="flex flex-wrap gap-2">
            {profile!.specializations.map((k) => {
              const ok = proven.has(k);
              return (
                <span
                  key={k}
                  title={ok ? t("specVerified") : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    ok
                      ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary-ink))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {ok && "✓ "}
                  {specLabel(k, locale)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {(profile?.bio ||
        (profile?.skills?.length ?? 0) > 0 ||
        (profile?.aiTools?.length ?? 0) > 0) && (
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          {profile?.bio && (
            <div className="sm:col-span-2">
              <h2 className="mb-2 font-semibold">{t("about")}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {profile.bio}
              </p>
            </div>
          )}
          <div className="space-y-5">
            {(profile?.skills?.length ?? 0) > 0 && (
              <div>
                <h2 className="mb-2 font-semibold">{t("skills")}</h2>
                <div className="flex flex-wrap gap-2">
                  {profile!.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(profile?.aiTools?.length ?? 0) > 0 && (
              <div>
                <h2 className="mb-2 font-semibold">{t("tools")}</h2>
                <div className="flex flex-wrap gap-2">
                  {profile!.aiTools.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-[hsl(var(--accent))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--accent))]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio — horizontal snap carousel (manual uploads first, then IG-synced) */}
      {(profile?.portfolio?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">{t("portfolio")}</h2>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {profile!.portfolio.map((p) => {
              const fromIg = p.source === "instagram";
              const isVideo = p.mediaType === "video";
              const media = (
                <span className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.mediaUrl}
                    alt={p.caption ?? ""}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  {isVideo && (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 pl-0.5 text-lg text-white backdrop-blur-sm">
                        ▶
                      </span>
                    </span>
                  )}
                </span>
              );
              return (
                <figure
                  key={p.id}
                  className="w-40 shrink-0 snap-start overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] sm:w-48"
                >
                  {/* Video: the image is the poster; the permalink is the playable source. */}
                  {isVideo && p.permalink ? (
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                      {media}
                    </a>
                  ) : (
                    media
                  )}
                  {fromIg && p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate px-2 py-1.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      ↗ {ti("viewOnInstagram")}
                    </a>
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      )}

      {/* Their gigs */}
      <h2 className="mb-4 text-xl font-semibold">{t("services")}</h2>
      {gigs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noGigs")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => {
            const from = g.packages[0]?.priceUzs ?? 0;
            return (
              <li key={g.id}>
              <Link
                href={`/gigs/${g.slug}`}
                className="flex h-full flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]"
              >
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-xl font-bold text-[hsl(var(--primary-ink))]">
                  {g.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    g.title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-medium">{g.title}</p>
                <p className="mt-auto pt-2 text-sm font-semibold tabular-nums">
                  {tg("from")} {formatUzs(from)} so&apos;m
                </p>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
