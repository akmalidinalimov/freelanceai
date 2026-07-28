import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Errors } from "@/lib/api";
import { notify } from "@/server/services/notification";

export interface SearchFilters {
  q?: string;
  categorySlug?: string;
  minUzs?: number;
  maxUzs?: number;
}

/** Build a gig WHERE from saved-search filters (simple ILIKE match — the cron path stays cheap). */
function searchWhere(s: SearchFilters): Prisma.GigWhereInput {
  return {
    status: "ACTIVE",
    deletedAt: null,
    ...(s.categorySlug ? { category: { slug: s.categorySlug } } : {}),
    ...(s.q
      ? {
          OR: [
            { title: { contains: s.q, mode: "insensitive" } },
            { description: { contains: s.q, mode: "insensitive" } },
            { tags: { has: s.q.toLowerCase() } },
          ],
        }
      : {}),
    ...(s.minUzs != null || s.maxUzs != null
      ? {
          packages: {
            some: {
              priceUzs: {
                ...(s.minUzs != null ? { gte: s.minUzs } : {}),
                ...(s.maxUzs != null ? { lte: s.maxUzs } : {}),
              },
            },
          },
        }
      : {}),
  };
}

export function searchLink(s: SearchFilters): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.categorySlug) p.set("category", s.categorySlug);
  if (s.minUzs != null) p.set("min", String(s.minUzs));
  if (s.maxUzs != null) p.set("max", String(s.maxUzs));
  const qs = p.toString();
  return `/gigs${qs ? `?${qs}` : ""}`;
}

export async function createSavedSearch(userId: string, f: SearchFilters) {
  if (!f.q && !f.categorySlug && f.minUzs == null && f.maxUzs == null) {
    throw Errors.validation({ search: "Add a keyword or filter first" });
  }
  const count = await prisma.savedSearch.count({ where: { userId } });
  if (count >= 20) throw Errors.validation({ search: "Saved-search limit reached" });
  return prisma.savedSearch.create({
    data: {
      userId,
      q: f.q?.slice(0, 100) || null,
      categorySlug: f.categorySlug || null,
      minUzs: f.minUzs ?? null,
      maxUzs: f.maxUzs ?? null,
    },
  });
}

export async function deleteSavedSearch(userId: string, id: string) {
  const res = await prisma.savedSearch.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw Errors.notFound("Saved search not found");
}

export function listSavedSearches(userId: string) {
  return prisma.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
}

/** Cron: notify users about new gigs matching their saved searches since the last check. */
export async function checkSavedSearches(): Promise<number> {
  const searches = await prisma.savedSearch.findMany({ take: 1000 });
  let sent = 0;
  for (const s of searches) {
    const filters: SearchFilters = {
      q: s.q ?? undefined,
      categorySlug: s.categorySlug ?? undefined,
      minUzs: s.minUzs ?? undefined,
      maxUzs: s.maxUzs ?? undefined,
    };
    const count = await prisma.gig
      .count({ where: { ...searchWhere(filters), createdAt: { gt: s.lastCheckedAt } } })
      .catch(() => 0);
    if (count > 0) {
      await notify(s.userId, "search.match", "Yangi mos xizmatlar", {
        body: `Saqlangan qidiruvingiz boʻyicha ${count} ta yangi xizmat.`,
        link: searchLink(filters),
      });
      sent++;
    }
    await prisma.savedSearch.update({ where: { id: s.id }, data: { lastCheckedAt: new Date() } }).catch(() => {});
  }
  return sent;
}
