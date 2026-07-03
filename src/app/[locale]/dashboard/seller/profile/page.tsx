import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSellerUser } from "@/lib/auth-guards";
import { getOwnProfile } from "@/server/services/profile";
import { ProfileForm } from "@/components/profile-form";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { InstagramConnect } from "@/components/instagram-connect";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ig?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ig } = await searchParams;
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
        <InstagramConnect
          connected={Boolean(profile?.instagramUserId)}
          handle={profile?.instagramUsername ?? null}
          syncedAt={profile?.instagramSyncedAt?.toISOString() ?? null}
          marker={ig}
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
      <div className="mt-8">
        <PortfolioEditor
          items={(profile?.portfolio ?? []).map((p) => ({
            id: p.id,
            mediaUrl: p.mediaUrl,
            caption: p.caption,
          }))}
        />
      </div>
    </div>
  );
}
