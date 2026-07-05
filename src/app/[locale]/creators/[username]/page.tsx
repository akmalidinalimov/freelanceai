import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPublicProfile, getProvenSpecKeys } from "@/server/services/profile";
import { fetchChannelPosts } from "@/server/services/telegram-channel";
import { isFollowing } from "@/server/services/follow";
import { getCurrentUser } from "@/lib/session";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { FollowButton } from "@/components/follow-button";
import { ShareButton } from "@/components/share-button";
import { VerifiedBadge } from "@/components/verified-badge";
import { PortfolioShowcase } from "@/components/portfolio-showcase";
import { TelegramShowcase } from "@/components/telegram-showcase";
import { ProfileBanner } from "@/components/profile-banner";
import { coverVariant } from "@/lib/cover-variant";
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

  const data = await getPublicProfile(username);
  if (!data) notFound();
  const { user, profile, gigs } = data;
  const earnedBadges = (await getUserBadges(user.id)).filter((b) => b.key.startsWith("seller_"));

  const name = user.firstName ?? user.name ?? user.username ?? "";
  const avatar = user.image ?? user.photoUrl ?? null;
  const memberYear = new Date(user.createdAt).getFullYear();
  // Per-creator variation for the fallback hero (when no banner uploaded).
  const heroV = coverVariant(user.id);

  // Split portfolio: Instagram-synced content becomes the auto-flowing showcase;
  // manual uploads keep their own gallery further down. FALLBACK (until the
  // Instagram sync unlocks with Meta App Review): when a creator has no synced
  // IG media, their manual uploads flow through the same showcase so every
  // profile leads with a living film strip — it upgrades to real Instagram
  // automatically once the sync goes live.
  // Unified Portfolio: merge the creator's manual uploads + synced Instagram into ONE
  // grid (each tile keeps its source for the badge). Telegram posts render separately.
  const allPortfolio = profile?.portfolio ?? [];
  const igItems = allPortfolio.filter((p) => p.source === "instagram");
  const uploads = allPortfolio.filter((p) => p.source !== "instagram");
  const portfolioItems = [
    ...uploads.map((p) => ({ id: p.id, mediaUrl: p.mediaUrl, mediaType: p.mediaType, permalink: p.permalink, caption: p.caption, source: "upload" })),
    ...igItems.map((p) => ({ id: p.id, mediaUrl: p.mediaUrl, mediaType: p.mediaType, permalink: p.permalink, caption: p.caption, source: "instagram" })),
  ];
  const igHandle = igItems.length ? (profile?.instagramUsername ?? null) : null;

  // Telegram portfolio (Masonry): manually-pinned post links show first, then the
  // channel's latest posts auto-fetched from its public preview (deduped). Enter a
  // handle once → the grid stays fresh; paste links to curate/pin or for private channels.
  const pinnedTgPosts = profile?.telegramPosts ?? [];
  const autoTgPosts = profile?.telegramChannel ? await fetchChannelPosts(profile.telegramChannel) : [];
  const tgPosts = [...pinnedTgPosts, ...autoTgPosts.filter((u) => !pinnedTgPosts.includes(u))].slice(0, 16);

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
      {/* Hero-first (variant 2): the banner leads and the identity is overlaid on it —
          "work speaks first". EVERY profile gets the hero: an uploaded banner, or a
          branded prism hero (varied per creator) as the fallback so it's always consistent. */}
      <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl">
            {profile?.bannerUrl && profile.bannerType ? (
              <ProfileBanner url={profile.bannerUrl} type={profile.bannerType} poster={profile.bannerPosterUrl ?? null} />
            ) : (
              <div className="aspect-[16/9] w-full sm:aspect-[5/2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/prism/pattern-sweep-v2.webp"
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: heroV.pos,
                    transform: heroV.flip ? "scaleX(-1)" : undefined,
                    filter: heroV.hue ? `hue-rotate(${heroV.hue}deg)` : undefined,
                  }}
                />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-16 sm:p-5 sm:pt-24">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/85 bg-gradient-to-br from-[hsl(var(--primary))]/40 to-[hsl(var(--accent))]/40 text-xl font-bold text-white sm:h-20 sm:w-20">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0 pb-1 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
                  {user.kycStatus === "VERIFIED" && <VerifiedBadge label={t("verified")} />}
                </div>
                {profile?.headline && <p className="mt-0.5 max-w-xl text-sm text-white/85">{profile.headline}</p>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-0.5 text-xs font-medium">{t(`level.${profile?.level ?? "NEW"}`)}</span>
            {profile && profile.ratingCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <Stars value={profile.ratingAvg} />
                <span className="font-medium tabular-nums">{profile.ratingAvg.toFixed(1)}</span>
                <span className="text-[hsl(var(--muted-foreground))]">({profile.ratingCount})</span>
              </span>
            ) : (
              <span className="text-[hsl(var(--muted-foreground))]">{t("noReviews")}</span>
            )}
            <span className="text-[hsl(var(--muted-foreground))]">
              {t("memberSince")} {memberYear}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ShareButton path={`/${locale}/creators/${username}`} title={name} />
              {viewer === "buyer" && <FollowButton sellerId={user.id} initialFollowing={following} />}
              {contactGigId && viewer !== "owner" && (
                <ContactSellerButton gigId={contactGigId} locale={locale} viewer={viewer} />
              )}
            </div>
          </div>
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
      </div>

      {/* Portfolio — merged uploads + Instagram in one zoom-grid */}
      <PortfolioShowcase items={portfolioItems} igHandle={igHandle} />

      {/* Telegram-channel portfolio — Masonry of live embedded posts (pinned + auto-fetched) */}
      <TelegramShowcase posts={tgPosts} channel={profile?.telegramChannel ?? null} />

      {/* Owner empty-state: nudge the creator to add their work (any source) if empty. */}
      {viewer === "owner" && portfolioItems.length === 0 && tgPosts.length === 0 && (
        <div className="mb-8 rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-6 text-center">
          <p className="font-semibold">{t("portfolioEmptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[hsl(var(--muted-foreground))]">{t("portfolioEmptyHint")}</p>
          <Link
            href="/dashboard/seller/portfolio"
            className="mt-3 inline-flex items-center rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
          >
            {t("portfolioManage")}
          </Link>
        </div>
      )}

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
