import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SPECIALIZATIONS, specSlug } from "@/lib/specializations";

// Render at request time: the image is built in CI with a dummy DATABASE_URL, so a
// build-time (static) sitemap would bake in zero gigs/categories/creators forever.
export const dynamic = "force-dynamic";

const LOCALES = ["uz", "ru", "en"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_ORIGIN ?? "https://freelanceai.aicreator.academy").replace(/\/$/, "");

  // Active gigs (best-effort — empty if the DB is unreachable at build time).
  const gigs = await prisma.gig
    .findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true, updatedAt: true },
      take: 1000,
    })
    .catch(() => [] as { slug: string; updatedAt: Date }[]);

  const categories = await prisma.category
    .findMany({ select: { slug: true }, take: 100 })
    .catch(() => [] as { slug: string }[]);

  // Creators with a public username and at least one active gig.
  const creators = await prisma.user
    .findMany({
      where: { username: { not: null }, gigs: { some: { status: "ACTIVE", deletedAt: null } } },
      select: { username: true, updatedAt: true },
      take: 1000,
    })
    .catch(() => [] as { username: string | null; updatedAt: Date }[]);

  const entries: MetadataRoute.Sitemap = [];
  for (const loc of LOCALES) {
    entries.push({ url: `${base}/${loc}`, changeFrequency: "weekly", priority: 1 });
    entries.push({ url: `${base}/${loc}/gigs`, changeFrequency: "daily", priority: 0.8 });
    entries.push({ url: `${base}/${loc}/browse`, changeFrequency: "weekly", priority: 0.7 });
    entries.push({ url: `${base}/${loc}/creators`, changeFrequency: "daily", priority: 0.7 });
    entries.push({ url: `${base}/${loc}/legal/terms`, changeFrequency: "yearly", priority: 0.3 });
    entries.push({ url: `${base}/${loc}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 });
    for (const s of SPECIALIZATIONS) {
      entries.push({
        url: `${base}/${loc}/browse/${specSlug(s.key)}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const c of categories) {
      entries.push({
        url: `${base}/${loc}/categories/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const g of gigs) {
      entries.push({
        url: `${base}/${loc}/gigs/${g.slug}`,
        lastModified: g.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const u of creators) {
      if (!u.username) continue;
      entries.push({
        url: `${base}/${loc}/creators/${u.username}`,
        lastModified: u.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }
  return entries;
}
