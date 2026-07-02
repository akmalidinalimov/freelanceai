import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdminUser } from "@/lib/auth-guards";
import { listFlaggedUsers } from "@/server/services/red-flags";

export const dynamic = "force-dynamic";

const dt = (d: Date) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";

const SEVERITY_STYLE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-300",
  MEDIUM: "bg-amber-100 text-amber-900 border-amber-300",
  LOW: "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border-[hsl(var(--border))]",
};

// Human explanation per signal so the panel is readable without docs.
const SIGNAL_LABEL: Record<string, string> = {
  CONTACT_REDACTED: "Repeated contact-info sharing attempts in chat",
  HIGH_DISPUTE: "Multiple disputed orders",
  REFUND_HEAVY: "Multiple refunds received",
  CONTACTS_NO_ORDERS: "Many seller contacts, zero paid orders",
  RAPID_CONTACTS: "Contact burst in the last 24h",
  NEW_ACCOUNT_HIGH_VALUE: "New account with unusually high paid volume",
  NEW_DEVICE_BURST: "Many new devices/IPs in the last 7 days",
};

export default async function AdminFlagsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const flagged = await listFlaggedUsers();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="mb-2 text-sm">
        <Link href="/admin" className="text-[hsl(var(--primary))] hover:underline">
          ← Admin
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">Red flags</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Deterministic trust &amp; safety signals, recomputed nightly. Every flag carries its
        evidence — click through to the user to investigate (their conversations are one link
        away and every transcript read is audit-logged).
      </p>

      {flagged.length === 0 ? (
        <p className="rounded-xl border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          No flagged users. The scan runs nightly (22:20 UTC); flags appear here as signals
          accumulate.
        </p>
      ) : (
        <div className="space-y-4">
          {flagged.map(({ user, flags }) => (
            <div key={user.id} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="font-semibold text-[hsl(var(--primary))] hover:underline"
                >
                  {user.username ? `@${user.username}` : (user.firstName ?? user.email ?? user.id)}
                </Link>
                {user.status !== "ACTIVE" && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                    {user.status}
                  </span>
                )}
                <Link
                  href={`/admin/conversations?user=${user.id}`}
                  className="text-xs text-[hsl(var(--primary))] hover:underline"
                >
                  conversations →
                </Link>
              </div>
              <ul className="space-y-1">
                {flags.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span>{SIGNAL_LABEL[f.type] ?? f.type}</span>
                    <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {f.details ? JSON.stringify(f.details) : ""} · {dt(f.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
