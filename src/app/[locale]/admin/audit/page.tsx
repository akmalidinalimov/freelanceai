import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { listAuditLogs } from "@/server/services/admin-users";

export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const { action } = await searchParams;
  const t = await getTranslations("AdminAudit");
  const logs = await listAuditLogs(action);

  const field = "h-10 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm";
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
      <form method="get" className="mb-6 flex gap-2">
        <input name="action" defaultValue={action ?? ""} placeholder={t("filterPh")} className={`${field} flex-1`} />
        <button
          type="submit"
          className="h-10 rounded-md bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {t("filter")}
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("none")}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))]">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-mono font-medium">{l.action}</span>
                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {l.entity}
                  {l.entityId ? ` · ${l.entityId.slice(-6)}` : ""} · {l.actor}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{ago(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
