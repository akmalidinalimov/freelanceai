import { setRequestLocale } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { listPendingKyc } from "@/server/services/admin-users";
import { KycRowActions } from "@/components/kyc-row-actions";

export const dynamic = "force-dynamic";

const name = (u: { firstName: string | null; name: string | null; username: string | null }) =>
  u.firstName ?? u.name ?? u.username ?? "—";

export default async function AdminKycPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const pending = await listPendingKyc();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">KYC review</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Users who submitted a phone number and are awaiting verification.
      </p>
      {pending.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No pending KYC.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
              <th className="py-2">User</th>
              <th>Phone</th>
              <th>Seller</th>
              <th>Payout card</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((u) => (
              <tr key={u.id} className="border-b border-[hsl(var(--border))]">
                <td className="py-2 font-medium">{name(u)}</td>
                <td className="font-mono">{u.phone ?? "—"}</td>
                <td>{u.isSeller ? "✓" : "—"}</td>
                <td className="font-mono">{u.payoutCardMasked ?? "—"}</td>
                <td className="py-2 text-right">
                  <KycRowActions userId={u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
