import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSellerUser } from "@/lib/auth-guards";
import { getOwnProfile } from "@/server/services/profile";
import { ProfileForm } from "@/components/profile-form";
import { BannerUploader } from "@/components/banner-uploader";
import { AvatarUpload } from "@/components/avatar-upload";
import { Images } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireSellerUser(locale);
  const t = await getTranslations("Profile");
  const profile = await getOwnProfile(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
        {user.username && (
          <Link href={`/creators/${user.username}`} className="text-sm text-[hsl(var(--primary-ink))] hover:underline">
            {t("viewPublic")}
          </Link>
        )}
      </div>
      <div className="mb-6">
        <AvatarUpload initialUrl={user.photoUrl} name={user.firstName ?? user.username} />
      </div>
      <div className="mb-6">
        <BannerUploader
          initial={
            profile?.bannerUrl && profile.bannerType
              ? { url: profile.bannerUrl, type: profile.bannerType, poster: profile.bannerPosterUrl ?? null }
              : null
          }
        />
      </div>
      <ProfileForm
        initial={{
          headline: profile?.headline ?? "",
          bio: profile?.bio ?? "",
          skills: (profile?.skills ?? []).join(", "),
          aiTools: (profile?.aiTools ?? []).join(", "),
          specializations: profile?.specializations ?? [],
          instagramUsername: profile?.instagramUsername ?? "",
        }}
      />
      <Link
        href="/dashboard/seller/portfolio"
        className="mt-8 flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors hover:border-[hsl(var(--primary))]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-ink))]">
          <Images className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">{t("portfolioHubTitle")}</span>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">{t("portfolioHubIntro")}</span>
        </span>
        <span className="ml-auto text-[hsl(var(--muted-foreground))]" aria-hidden>→</span>
      </Link>
    </div>
  );
}
