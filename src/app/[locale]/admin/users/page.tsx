import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listUsersForAdmin } from "@/server/services/admin-users";
import { UserRowActions } from "@/components/user-row-actions";

/** Compact "how long ago" for activity columns (admin-only page — English is fine). */
function ago(d: Date | null): string {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (24 * 60))}d`;
}

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const { q } = await searchParams;
  const t = await getTranslations("AdminUsers");
  const users = await listUsersForAdmin(q);

  const field = "h-10 rounded-md border border-[hsl(var(--input-border))] bg-transparent px-3 text-sm";
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
      <form method="get" className="mb-6 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder={t("searchPh")} className={`${field} flex-1`} />
        <button
          type="submit"
          className="h-10 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {t("search")}
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
                <th className="py-2">{t("user")}</th>
                <th>{t("role")}</th>
                <th>{t("status")}</th>
                <th className="tabular-nums">{t("orders")}</th>
                <th className="tabular-nums">{t("sales")}</th>
                <th className="tabular-nums">Contacts</th>
                <th className="tabular-nums">Msgs</th>
                <th>Seen</th>
                <th>TG chat</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[hsl(var(--border))]">
                  <td className="py-2">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-[hsl(var(--primary-ink))] hover:underline">
                      {u.name || "(no name)"}
                    </Link>
                    {u.username && (
                      <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">@{u.username}</span>
                    )}
                  </td>
                  <td>
                    {u.role === "ADMIN" ? "ADMIN" : u.isSeller ? t("seller") : t("buyer")}
                  </td>
                  <td>
                    <span
                      className={
                        u.status === "ACTIVE" ? "text-[hsl(var(--foreground))]" : "text-red-700"
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="tabular-nums">{u.orders}</td>
                  <td className="tabular-nums">{u.sales}</td>
                  <td className="tabular-nums">{u.contacts}</td>
                  <td className="tabular-nums">{u.messages}</td>
                  <td className="text-xs">{ago(u.lastSeenAt)}</td>
                  <td className="text-xs">{ago(u.telegramLastChatAt)}</td>
                  <td>
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                    ) : (
                      <UserRowActions userId={u.id} status={u.status} isSeller={u.isSeller} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
