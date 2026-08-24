/**
 * Runs once on server startup. Best-effort: enable pg_trgm + GIN trigram indexes on gig
 * text so fuzzy/typo-tolerant search works (these can't be expressed in `prisma db push`).
 * Idempotent (IF NOT EXISTS); failures are non-fatal (search falls back to ILIKE).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS gig_title_trgm ON "Gig" USING gin (title gin_trgm_ops)`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS gig_description_trgm ON "Gig" USING gin (description gin_trgm_ops)`
    );
    console.log("[instrumentation] pg_trgm + gig trigram indexes ready");
  } catch (e) {
    console.error("[instrumentation] trigram setup skipped:", e);
  }
}
