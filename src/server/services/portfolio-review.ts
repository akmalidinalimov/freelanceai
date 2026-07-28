import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchInlinePart, geminiConfigured, geminiJson, GEMINI_MODEL } from "@/lib/gemini";
import { runL0, type L0Result } from "@/server/services/portfolio-l0";
import { specLabel } from "@/lib/specializations";
import { formatUzs } from "@/lib/utils";

/**
 * Portfolio review pipeline. L0 (free, deterministic) then Gemini for pixels + audio.
 *
 * The rubric is deliberately written against OBSERVABLE properties, not "would a brand
 * pay for this" — asked that directly, a model flatters mediocre work and everything
 * passes. Instead each axis names concrete evidence, the scale is anchored so 3 means
 * something specific, and the model is told to default DOWN when unsure. Nothing here
 * auto-approves: the output is evidence for a human decision.
 */

const MAX_MEDIA = 6; // sample size per review — enough signal, bounded cost

const SYSTEM = `You review freelance portfolios on an Uzbek AI-creative marketplace. You are a strict, experienced creative director doing intake QA, not a supportive mentor.

Score ONLY what you can observe in the attached media. If evidence is missing or ambiguous, score DOWN — an unverifiable claim is not a pass. Never infer skill from the caption or the seller's own description.

Anchored scale, applied per axis:
1 = unusable: phone snapshot quality, broken anatomy/text, obvious template with nothing changed, or unreadable subject.
2 = amateur: recognisable attempt but soft focus, muddy lighting, clashing composition, visible AI artifacts in hands/faces/text.
3 = competent floor: technically clean and on-brief, but generic — the kind of output anyone gets from a default prompt. THIS IS THE DEFAULT for work with no distinguishing craft.
4 = professional: deliberate lighting/composition/colour, consistent style across items, would survive on a real brand's feed without edits.
5 = exceptional: art direction a client could not produce themselves; distinct point of view held consistently.

Axes:
- craft: technical execution and finish.
- commercialUse: is this USABLE in a paid job? Adequate resolution and framing, clean space for a logo or headline where the format implies it, product/subject legible and undistorted, aspect ratio suited to the stated channel.
- coherence: do the items read as one creator's deliberate body of work, or as unrelated scraps?
- specMatch: does the work actually demonstrate the specialization the seller claims? A voiceover claim needs audible voice work; an AI-video claim needs motion, not stills.

Blockers (report in "blockers", and cap overall at 2 if any are certain): visible watermark or another platform's UI, stock-library framing with watermark remnants, screenshots of software rather than output, content unrelated to any creative service, adult or violent content.

For video, judge the motion and the AUDIO too: is the voiceover clear and free of background noise, does timing/pacing look intentional, are cuts clean.

reasons: 2-4 short, specific, evidence-anchored strings a seller could act on. Never generic praise. Write them in the seller's language when given.`;

const SCHEMA = {
  type: "object",
  properties: {
    craft: { type: "integer" },
    commercialUse: { type: "integer" },
    coherence: { type: "integer" },
    specMatch: { type: "integer" },
    overall: { type: "integer" },
    verdict: { type: "string", enum: ["pass", "borderline", "reject"] },
    blockers: { type: "array", items: { type: "string" } },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["craft", "commercialUse", "coherence", "specMatch", "overall", "verdict", "reasons"],
} as const;

export interface AiReview {
  craft: number;
  commercialUse: number;
  coherence: number;
  specMatch: number;
  overall: number;
  verdict: "pass" | "borderline" | "reject";
  blockers?: string[];
  reasons: string[];
}

const clamp5 = (n: unknown) => Math.max(1, Math.min(5, Math.round(Number(n) || 0)));

/**
 * Full review for one seller: L0 gate, then (when it is worth spending) the Gemini
 * pass. Persists a PortfolioAssessment row either way so thresholds can be calibrated
 * later from history. `force` runs the AI pass even when L0 found blockers — used by
 * the calibration run, which needs scores for known-good sellers regardless.
 */
export async function reviewSellerPortfolio(
  sellerId: string,
  opts: { force?: boolean } = {}
): Promise<{ l0: L0Result; ai: AiReview | null; assessmentId: string }> {
  const l0 = await runL0(sellerId);

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      locale: true,
      sellerProfile: { select: { specializations: true, headline: true, experienceYears: true } },
      gigs: {
        where: { deletedAt: null },
        select: { title: true, packages: { select: { priceUzs: true }, orderBy: { priceUzs: "asc" }, take: 1 } },
        take: 3,
      },
    },
  });

  // Only spend tokens when there is something to look at and no certain blocker.
  const worthReviewing = l0.itemsPassed > 0 && l0.blockers.length === 0;
  let ai: AiReview | null = null;

  if (geminiConfigured() && (opts.force || worthReviewing)) {
    const items = await prisma.portfolioItem.findMany({
      where: { profile: { userId: sellerId } },
      select: { mediaUrl: true, mediaType: true, caption: true },
      orderBy: { position: "asc" },
      take: MAX_MEDIA,
    });
    const media = [];
    for (const it of items) {
      const part = await fetchInlinePart(it.mediaUrl);
      if (part) media.push(part);
    }

    if (media.length > 0) {
      const specs = (seller?.sellerProfile?.specializations ?? [])
        .map((k) => specLabel(k, "en"))
        .join(", ");
      const price = seller?.gigs?.[0]?.packages?.[0]?.priceUzs;
      const langName = seller?.locale === "ru" ? "Russian" : seller?.locale === "en" ? "English" : "Uzbek";
      const prompt = [
        `Claimed specializations: ${specs || "(none declared)"}`,
        seller?.sellerProfile?.headline ? `Seller headline: ${seller.sellerProfile.headline}` : "",
        seller?.sellerProfile?.experienceYears != null
          ? `Claimed experience: ${seller.sellerProfile.experienceYears}+ years`
          : "",
        seller?.gigs?.[0]?.title ? `Their service: ${seller.gigs[0].title}` : "",
        // Price anchors the bar: grade against what is being SOLD, not an absolute ideal.
        price ? `Entry price for that service: ${formatUzs(price)} so'm — judge value for THIS price.` : "",
        `${media.length} portfolio item(s) attached.`,
        `Write "reasons" in ${langName}.`,
      ]
        .filter(Boolean)
        .join("\n");

      const raw = await geminiJson<AiReview>({ system: SYSTEM, prompt, media, schema: SCHEMA });
      if (raw) {
        ai = {
          craft: clamp5(raw.craft),
          commercialUse: clamp5(raw.commercialUse),
          coherence: clamp5(raw.coherence),
          specMatch: clamp5(raw.specMatch),
          overall: clamp5(raw.overall),
          verdict: raw.verdict === "pass" || raw.verdict === "reject" ? raw.verdict : "borderline",
          blockers: Array.isArray(raw.blockers) ? raw.blockers.slice(0, 6) : [],
          reasons: Array.isArray(raw.reasons) ? raw.reasons.slice(0, 4).map(String) : [],
        };
      }
    }
  }

  const row = await prisma.portfolioAssessment.create({
    data: {
      sellerId,
      stage: ai ? "full" : "l0",
      l0Score: l0.score,
      itemsTotal: l0.itemsTotal,
      itemsPassed: l0.itemsPassed,
      craft: ai?.craft ?? null,
      commercialUse: ai?.commercialUse ?? null,
      coherence: ai?.coherence ?? null,
      specMatch: ai?.specMatch ?? null,
      overall: ai?.overall ?? null,
      verdict: ai?.verdict ?? null,
      reasons: ai ? { reasons: ai.reasons } : undefined,
      model: ai ? GEMINI_MODEL : null,
      blockers: [...l0.blockers, ...(ai?.blockers ?? [])],
    },
    select: { id: true },
  });

  return { l0, ai, assessmentId: row.id };
}
