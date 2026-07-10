// Pre-launch DEMO stats so gig tiles look alive (rating, order count, "Top ijodkor").
// DEMO-ONLY — reset before real launch (same category as FREE_ORDERS).
//
// Deliberately fills ONLY empty stats (ratingCount=0 / salesCount=0), so any REAL
// review/order data is never overwritten. Deterministic from ids → idempotent, stable
// numbers across re-runs. This is the founder-approved override of the "no fabricated
// ratings" seed rule, scoped to pre-launch demo content only.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Stable non-negative hash of a string (no RNG → same numbers every run). */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function main() {
  // Seller ratings — only profiles with no real reviews yet.
  const profiles = await prisma.sellerProfile.findMany({
    where: { ratingCount: 0 },
    select: { id: true, userId: true },
  });
  for (const p of profiles) {
    const h = hash(p.userId);
    const ratingCount = 24 + (h % 116); // 24–139 reviews
    const ratingAvg = Math.round((4.6 + ((h >> 3) % 5) * 0.1) * 10) / 10; // 4.6–5.0
    await prisma.sellerProfile.update({ where: { id: p.id }, data: { ratingAvg, ratingCount } });
  }

  // Gig order counts + a "Top ijodkor" subset — only gigs with no real orders yet.
  const gigs = await prisma.gig.findMany({
    where: { salesCount: 0, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  let featured = 0;
  for (const g of gigs) {
    const h = hash(g.id);
    const salesCount = 18 + (h % 170); // 18–187 orders
    const isFeatured = h % 4 === 0; // ~25% get the top badge
    if (isFeatured) featured++;
    await prisma.gig.update({ where: { id: g.id }, data: { salesCount, featured: isFeatured } });
  }

  console.log(`demo-stats: updated ${profiles.length} profiles, ${gigs.length} gigs (${featured} featured).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
