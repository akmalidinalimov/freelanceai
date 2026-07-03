import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listBroadcasts } from "@/server/services/broadcast";
import { BroadcastForm } from "@/components/broadcast-form";

export const dynamic = "force-dynamic";

const dt = (d: Date) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default async function AdminBroadcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const history = await listBroadcasts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin" className="text-[hsl(var(--primary))] hover:underline">
          ← Admin
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">Broadcast</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Send a one-off message to Telegram bot users. Throttled + resumable; blocked users are
        skipped automatically.
      </p>

      <BroadcastForm />

      <h2 className="mb-2 mt-8 text-lg font-bold">History</h2>
      {history.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No broadcasts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/40 text-left text-xs text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Audience</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium tabular-nums">Sent</th>
                <th className="px-3 py-2 font-medium tabular-nums">Failed</th>
                <th className="px-3 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {history.map((b) => (
                <tr key={b.id} className="border-t border-[hsl(var(--border))]">
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{dt(b.createdAt)}</td>
                  <td className="px-3 py-2">{b.audience}</td>
                  <td className="px-3 py-2">{b.status}</td>
                  <td className="px-3 py-2 tabular-nums">{b.sentCount}</td>
                  <td className="px-3 py-2 tabular-nums">{b.failedCount}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-[hsl(var(--muted-foreground))]">
                    {b.message}
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
