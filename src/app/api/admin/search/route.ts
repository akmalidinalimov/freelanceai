import { ok, errorResponse, Errors } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * Admin quick-search: one query, three record types (users / gigs / orders), top 5
 * each — powers the topbar jump box so any record is one keystroke away.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);

    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return ok({ users: [], gigs: [], orders: [] });

    const contains = { contains: q, mode: "insensitive" as const };
    const [users, gigs, orders] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { username: contains },
            { firstName: contains },
            { name: contains },
            { email: contains },
            { telegramId: { contains: q } },
          ],
        },
        take: 5,
        select: { id: true, firstName: true, name: true, username: true, isSeller: true, role: true },
      }),
      prisma.gig.findMany({
        where: { title: contains, deletedAt: null },
        take: 5,
        select: { id: true, title: true, status: true, slug: true, sellerId: true },
      }),
      prisma.order.findMany({
        where: { id: { contains: q } },
        take: 5,
        select: { id: true, status: true, gig: { select: { title: true } } },
      }),
    ]);

    return ok({
      users: users.map((u) => ({
        id: u.id,
        label: u.firstName ?? u.name ?? u.username ?? u.id,
        sub: `${u.role === "ADMIN" ? "ADMIN" : u.isSeller ? "seller" : "buyer"}${u.username ? " · @" + u.username : ""}`,
      })),
      gigs: gigs.map((g) => ({
        id: g.id,
        label: g.title,
        sub: g.status,
        href: g.status === "PENDING_REVIEW" ? "/admin/moderation" : `/gigs/${g.slug}`,
        sellerId: g.sellerId,
      })),
      orders: orders.map((o) => ({ id: o.id, label: o.gig.title, sub: `${o.status} · #${o.id.slice(-6)}` })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
