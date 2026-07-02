import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listConversationsForAdmin } from "@/server/services/admin-conversations";

export const dynamic = "force-dynamic";

const dt = (d: Date) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const who = (u: { username: string | null; firstName: string | null; email: string | null } | null) =>
  u?.username ? `@${u.username}` : (u?.firstName ?? u?.email ?? "—");

export default async function AdminConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ user?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const { user } = await searchParams;
  const convos = await listConversationsForAdmin(user);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin" className="text-[hsl(var(--primary))] hover:underline">
          ← Admin
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">Conversations</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Read-only moderation view. Every transcript you open is recorded in the audit log.
        {user && (
          <>
            {" "}Filtered to user <span className="font-mono">{user}</span> —{" "}
            <Link href="/admin/conversations" className="text-[hsl(var(--primary))] hover:underline">
              clear filter
            </Link>
          </>
        )}
      </p>

      {convos.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No conversations found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/40 text-left text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Context</th>
                <th className="px-3 py-2 font-medium tabular-nums">Msgs</th>
                <th className="px-3 py-2 font-medium">Last activity</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {convos.map((c) => (
                <tr key={c.id} className="border-t border-[hsl(var(--border))]">
                  <td className="px-3 py-2">
                    {c.buyer ? (
                      <Link href={`/admin/users/${c.buyer.id}`} className="hover:underline">
                        {who(c.buyer)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.seller ? (
                      <Link href={`/admin/users/${c.seller.id}`} className="hover:underline">
                        {who(c.seller)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {c.order ? `Order ${c.order.status}` : "Direct"}
                    {c.gigTitle ? ` · ${c.gigTitle}` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.messageCount}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {dt(c.lastMessageAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/conversations/${c.id}`}
                      className="text-[hsl(var(--primary))] hover:underline"
                    >
                      View
                    </Link>
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
