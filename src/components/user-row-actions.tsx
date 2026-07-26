import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

/**
 * Row actions in the admin user list: two links into the user's dossier —
 * Statistics (their numbers) and Manage (edit + moderate).
 *
 * Deliberately NOT inline action buttons any more: a single mis-click used to
 * suspend a real account with no confirmation. State changes now happen on the
 * detail page, where the admin can see who they're acting on.
 */
export async function UserRowActions({ userId }: { userId: string }) {
  const t = await getTranslations("AdminUsers");
  const cls = "text-[hsl(var(--primary-ink))] hover:underline";
  return (
    <span className="flex items-center gap-3 whitespace-nowrap text-xs">
      <Link href={`/admin/users/${userId}`} className={cls}>
        📊 {t("statistics")}
      </Link>
      <Link href={`/admin/users/${userId}?tab=manage`} className={cls}>
        {t("manage")}
      </Link>
    </span>
  );
}
