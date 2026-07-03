import { setRequestLocale } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth-guards";
import { matchCreators } from "@/server/services/match";

export const dynamic = "force-dynamic";

export default async function SearchDebugPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  await requireAdminUser(locale);

  const query = (q ?? "").trim();
  const data = query ? await matchCreators(query, { locale, limit: 20 }) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Search debug</h1>
      <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        Ranking = 0.50·relevance + 0.25·proof + 0.25·quality. Proven niche matches lift
        relevance (+0.5) above declared-only (+0.25).
      </p>

      <form method="get" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="e.g. fashion AI video"
          className="flex-1 rounded-lg border border-[hsl(var(--input-border))] bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
        >
          Run
        </button>
      </form>

      {data && (
        <>
          <div className="mb-3 text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">Detected specs:</span>{" "}
            {data.intent.specLabels.length ? data.intent.specLabels.join(", ") : "—"}
            <span className="ml-3 text-[hsl(var(--muted-foreground))]">Expanded terms:</span>{" "}
            {data.intent.terms.join(", ") || "—"}
          </div>
          <div
            className={`mb-4 inline-block rounded-lg px-3 py-1.5 text-sm ${
              data.results.length === 0
                ? "bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]"
                : "bg-[hsl(var(--muted))]/50"
            }`}
          >
            Results: <b>{data.results.length}</b>
            {data.results.length === 0 && " — ⚠ zero results"}
          </div>

          {data.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
                    <th className="py-2 pr-3">#</th>
                    <th className="pr-3">Creator</th>
                    <th className="pr-3">Score</th>
                    <th className="pr-3">Rel</th>
                    <th className="pr-3">Proof</th>
                    <th className="pr-3">Qual</th>
                    <th className="pr-3">Orders</th>
                    <th className="pr-3">Matched specs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r, i) => (
                    <tr key={r.sellerId} className="border-b border-[hsl(var(--border))]">
                      <td className="py-2 pr-3 tabular-nums">{i + 1}</td>
                      <td className="pr-3">
                        {r.name}
                        {r.verified && " ✓"}{" "}
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">({r.level})</span>
                      </td>
                      <td className="pr-3 font-bold tabular-nums">{r.score}%</td>
                      <td className="pr-3 tabular-nums">{r.components.relevance}</td>
                      <td className="pr-3 tabular-nums">{r.components.proof}</td>
                      <td className="pr-3 tabular-nums">{r.components.quality}</td>
                      <td className="pr-3 tabular-nums">{r.completedOrders}</td>
                      <td className="pr-3">{r.matchedSpecs.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
