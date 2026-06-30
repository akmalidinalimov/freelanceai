import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPublicProfile } from "@/server/services/profile";
import { getCurrentUser } from "@/lib/session";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { VerifiedBadge } from "@/components/verified-badge";

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
    description: data.profile?.headline ?? `${name} — FreelanceAI`,
  };
}
import { formatUzs } from "@/lib/utils";
import { Stars } from "@/components/stars";

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

  const name = user.firstName ?? user.name ?? user.username ?? "";
  const avatar = user.image ?? user.photoUrl ?? null;
  const memberYear = new Date(user.createdAt).getFullYear();

  const me = await getCurrentUser().catch(() => null);
  const viewer = !me ? "guest" : me.id === user.id ? "owner" : "buyer";
  const contactGigId = gigs[0]?.id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Identity card */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--accent))]/20 text-2xl font-bold text-[hsl(var(--primary))]">
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
          {profile?.headline && <p className="mt-3 font-medium">{profile.headline}</p>}
          {contactGigId && viewer !== "owner" && (
            <div className="mt-3">
              <ContactSellerButton gigId={contactGigId} locale={locale} viewer={viewer} />
            </div>
          )}
        </div>
      </div>

      {(profile?.bio || (profile?.skills?.length ?? 0) > 0) && (
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          {profile?.bio && (
            <div className="sm:col-span-2">
              <h2 className="mb-2 font-semibold">{t("about")}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {profile.bio}
              </p>
            </div>
          )}
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
        </div>
      )}

      {/* Portfolio */}
      {(profile?.portfolio?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">{t("portfolio")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {profile!.portfolio.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.mediaUrl}
                  alt={p.caption ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Their gigs */}
      <h2 className="mb-4 text-xl font-semibold">{t("services")}</h2>
      {gigs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("noGigs")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => {
            const from = g.packages[0]?.priceUzs ?? 0;
            return (
              <Link
                key={g.id}
                href={`/gigs/${g.slug}`}
                className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--primary))]"
              >
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(var(--primary))]/15 to-[hsl(var(--accent))]/15 text-xl font-bold text-[hsl(var(--primary))]">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
