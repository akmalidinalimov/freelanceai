import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { reviewSellerPortfolio } from "@/server/services/portfolio-review";

const schema = z
  .object({
    // "one": review a single seller. "calibrate": score labelled cohorts so thresholds
    // can be set from real distributions instead of guesses.
    mode: z.enum(["one", "calibrate"]).default("one"),
    sellerId: z.string().min(1).max(40).optional(),
    /** calibrate only: how many sellers per cohort (kept small — each one costs tokens). */
    limit: z.number().int().min(1).max(25).optional(),
  })
  .strict();

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

/**
 * Admin-only portfolio review. Nothing here approves or rejects anyone: it produces
 * scores + reasons for a human decision, and the calibration mode exists so thresholds
 * are chosen from how KNOWN-GOOD sellers actually score.
 *
 * Cohorts used for calibration:
 *  - "course": AI CREATORS graduates (vetted offline)      → expected high
 *  - "earning": sellers with a completed order rated ≥4    → market-validated
 *  - "pending": sellers awaiting approval                  → the population being judged
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    requireAdmin(user);
    const { mode, sellerId, limit } = parseInput(schema, await request.json().catch(() => ({})));

    if (mode === "one") {
      if (!sellerId) throw Errors.validation({ sellerId: "Required" });
      const { l0, ai, assessmentId } = await reviewSellerPortfolio(sellerId, { force: true });
      return ok({ assessmentId, l0: { score: l0.score, itemsTotal: l0.itemsTotal, itemsPassed: l0.itemsPassed, blockers: l0.blockers }, ai });
    }

    const take = limit ?? 5;
    const [course, earning, pending] = await Promise.all([
      prisma.user.findMany({
        where: { isSeller: true, isCourseStudent: true, sellerProfile: { isNot: null } },
        select: { id: true },
        take,
      }),
      prisma.user.findMany({
        where: { isSeller: true, ordersAsSeller: { some: { status: "COMPLETED", review: { rating: { gte: 4 } } } } },
        select: { id: true },
        take,
      }),
      prisma.user.findMany({
        where: { isSeller: true, sellerProfile: { is: { approvalStatus: "PENDING" } } },
        select: { id: true },
        take,
      }),
    ]);

    const cohorts: Record<string, string[]> = {
      course: course.map((u) => u.id),
      earning: earning.map((u) => u.id),
      pending: pending.map((u) => u.id),
    };

    const report: Record<string, unknown> = {};
    for (const [name, ids] of Object.entries(cohorts)) {
      const rows: { sellerId: string; l0: number; overall: number | null; verdict: string | null; blockers: string[] }[] = [];
      for (const id of ids) {
        const { l0, ai } = await reviewSellerPortfolio(id, { force: true });
        rows.push({ sellerId: id, l0: l0.score, overall: ai?.overall ?? null, verdict: ai?.verdict ?? null, blockers: [...l0.blockers, ...(ai?.blockers ?? [])] });
      }
      const scored = rows.filter((r) => r.overall !== null);
      report[name] = {
        n: rows.length,
        avgL0: avg(rows.map((r) => r.l0)),
        avgOverall: avg(scored.map((r) => r.overall as number)),
        verdicts: scored.reduce<Record<string, number>>((acc, r) => {
          const k = r.verdict ?? "none";
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        rows,
      };
    }

    // Deliberately no threshold is applied or stored — read the distributions first.
    return ok({ note: "Calibration only. Compare cohorts before choosing a threshold.", report });
  } catch (err) {
    return errorResponse(err);
  }
}
