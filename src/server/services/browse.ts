import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface BrowseCreator {
  username: string | null;
  name: string;
  avatar: string | null;
  verified: boolean;
  level: string;
  ratingAvg: number;
  ratingCount: number;
  headline: string | null;
  specializations: string[];
}

const sellerSelect = {
  ratingAvg: true,
  ratingCount: true,
  level: true,
  specializations: true,
  headline: true,
  user: {
    select: {
      username: true,
      firstName: true,
      name: true,
      image: true,
      photoUrl: true,
      kycStatus: true,
    },
  },
} satisfies Prisma.SellerProfileSelect;

type SellerRow = Prisma.SellerProfileGetPayload<{ select: typeof sellerSelect }>;

function toCreator(p: SellerRow): BrowseCreator {
  return {
    username: p.user.username,
    name: p.user.firstName ?? p.user.name ?? p.user.username ?? "",
    avatar: p.user.image ?? p.user.photoUrl ?? null,
    verified: p.user.kycStatus === "VERIFIED",
    level: p.level,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    headline: p.headline,
    specializations: p.specializations,
  };
}

/** Active sellers who declared a given specialization key, best first. */
async function listCreatorsBySpecializationUncached(key: string): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { specializations: { has: key }, user: { isSeller: true, status: "ACTIVE" } },
    select: sellerSelect,
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 48,
  });
  return rows.map(toCreator);
}

/** Featured creators for the homepage rail: active sellers with at least one live gig. */
async function listFeaturedCreatorsUncached(limit = 8): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: {
      user: {
        isSeller: true,
        status: "ACTIVE",
        gigs: { some: { status: "ACTIVE", deletedAt: null } },
      },
    },
    select: sellerSelect,
    orderBy: [{ ratingCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
  });
  return rows.map(toCreator);
}

/** Count of active seller accounts (for the hero's live-creator eyebrow). */
function countActiveCreatorsUncached(): Promise<number> {
  return prisma.sellerProfile.count({ where: { user: { isSeller: true, status: "ACTIVE" } } });
}

export interface HomeStats {
  gigs: number;
  creators: number;
  orders: number;
}

/** Public platform totals for the homepage counter (active gigs, creators, completed orders). */
async function getHomeStatsUncached(): Promise<HomeStats> {
  const [gigs, creators, orders] = await Promise.all([
    prisma.gig.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.sellerProfile.count({ where: { user: { isSeller: true, status: "ACTIVE" } } }),
    // Free test orders are not real marketplace activity — keep the public counter honest.
    prisma.order.count({ where: { status: "COMPLETED", isTest: false } }),
  ]);
  return { gigs, creators, orders };
}

/** All active sellers for the /creators index, best-rated first. */
async function listAllCreatorsUncached(take = 60): Promise<BrowseCreator[]> {
  const rows = await prisma.sellerProfile.findMany({
    where: { user: { isSeller: true, status: "ACTIVE" } },
    select: sellerSelect,
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take,
  });
  return rows.map(toCreator);
}

export interface ActivityEvent {
  type: "delivered" | "review" | "joined";
  /** Public first name of the (active) seller involved. */
  name: string;
  /** delivered → gig title; review → rating as string; joined → "". */
  extra: string;
}

/**
 * REAL recent marketplace events for the homepage ticker — completed orders, fresh
 * high ratings, new creators. Replaces the launch-era hardcoded strings: everything
 * shown here must trace to a DB row (honest social proof). Names are already public
 * on the creators' own profiles. Empty result → the ticker simply doesn't render.
 */
async function listRecentActivityUncached(): Promise<ActivityEvent[]> {
  const sellerName = (u: { firstName: string | null; name: string | null; username: string | null }) =>
    u.firstName ?? u.name ?? u.username ?? "";

  const [delivered, reviews, joined] = await Promise.all([
    prisma.order.findMany({
      // Test orders are not real social proof — exclude from the public activity ticker.
      where: { status: "COMPLETED", isTest: false, seller: { status: "ACTIVE" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        seller: { select: { firstName: true, name: true, username: true } },
        gig: { select: { title: true } },
      },
    }),
    prisma.review.findMany({
      where: { rating: { gte: 4 }, order: { isTest: false }, gig: { seller: { status: "ACTIVE" } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        rating: true,
        gig: { select: { seller: { select: { firstName: true, name: true, username: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { isSeller: true, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { firstName: true, name: true, username: true },
    }),
  ]);

  const events: ActivityEvent[] = [];
  const trim = (s: string) => (s.length > 44 ? `${s.slice(0, 44).trimEnd()}…` : s);
  // A real display name (drops single-letter seed handles like "B" that read as
  // fabricated social proof). Also dedupe by person: one name appears at most
  // once across the whole ticker, so it can't repeat ("B joined ×2").
  const seen = new Set<string>();
  const goodName = (n: string) => n.trim().length >= 2;
  for (const o of delivered) {
    const name = sellerName(o.seller);
    if (goodName(name) && !seen.has(name)) {
      seen.add(name);
      events.push({ type: "delivered", name, extra: trim(o.gig.title) });
    }
  }
  for (const r of reviews) {
    const name = sellerName(r.gig.seller);
    if (goodName(name) && !seen.has(name)) {
      seen.add(name);
      events.push({ type: "review", name, extra: String(r.rating) });
    }
  }
  for (const u of joined) {
    const name = sellerName(u);
    if (goodName(name) && !seen.has(name)) {
      seen.add(name);
      events.push({ type: "joined", name, extra: "" });
    }
  }

  // Interleave the three streams so the ticker doesn't read as blocks of one kind.
  const byType = { delivered: [] as ActivityEvent[], review: [] as ActivityEvent[], joined: [] as ActivityEvent[] };
  for (const e of events) byType[e.type].push(e);
  const mixed: ActivityEvent[] = [];
  for (let i = 0; i < 5 && mixed.length < 10; i++) {
    for (const k of ["delivered", "review", "joined"] as const) {
      const e = byType[k][i];
      if (e && mixed.length < 10) mixed.push(e);
    }
  }
  // Below a real-activity floor the marquee just loops 1-2 items, which reads as
  // fake. Better to show nothing (the ticker renders null on an empty array).
  return mixed.length >= 4 ? mixed : [];
}

export const listRecentActivity = unstable_cache(listRecentActivityUncached, ["home-activity"], {
  revalidate: 300,
});

// Hot anonymous discovery reads, cached 60s per args (home rail, /creators, /browse/[spec]).
export const listCreatorsBySpecialization = unstable_cache(
  listCreatorsBySpecializationUncached,
  ["creators-by-spec"],
  { revalidate: 60 }
);
export const listFeaturedCreators = unstable_cache(listFeaturedCreatorsUncached, ["featured-creators"], {
  revalidate: 60,
});
export const countActiveCreators = unstable_cache(countActiveCreatorsUncached, ["creator-count"], {
  revalidate: 300,
});
export const getHomeStats = unstable_cache(getHomeStatsUncached, ["home-stats"], {
  revalidate: 300,
});
export const listAllCreators = unstable_cache(listAllCreatorsUncached, ["all-creators"], {
  revalidate: 60,
});
