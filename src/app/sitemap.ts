import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

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

  const entries: MetadataRoute.Sitemap = [];
  for (const loc of LOCALES) {
    entries.push({ url: `${base}/${loc}`, changeFrequency: "weekly", priority: 1 });
    entries.push({ url: `${base}/${loc}/gigs`, changeFrequency: "daily", priority: 0.8 });
    for (const g of gigs) {
      entries.push({
        url: `${base}/${loc}/gigs/${g.slug}`,
        lastModified: g.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }
  return entries;
}
