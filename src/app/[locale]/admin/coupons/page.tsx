import { setRequestLocale } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { listCoupons } from "@/server/services/coupon";
import { formatUzs } from "@/lib/utils";
import { CouponForm } from "@/components/coupon-form";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminUser(locale);
  const coupons = await listCoupons();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Promo codes</h1>
      <div className="mb-6">
        <CouponForm />
      </div>
      {coupons.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
              <th className="py-2">Code</th>
              <th>Discount</th>
              <th>Uses</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-[hsl(var(--border))]">
                <td className="py-2 font-mono font-medium">{c.code}</td>
                <td>{c.percentOff != null ? `${c.percentOff}%` : `${formatUzs(c.amountOffUzs ?? 0)} so'm`}</td>
                <td className="tabular-nums">
                  {c.uses}/{c.maxUses}
                </td>
                <td>{c.active ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
