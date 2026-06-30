import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { createGig } from "@/server/services/gig";

const packageSchema = z.object({
  tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
  title: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  priceUzs: z.number().int().min(1000).max(100_000_000),
  deliveryDays: z.number().int().min(1).max(90),
  revisions: z.number().int().min(0).max(20),
});

const schema = z
  .object({
    title: z.string().min(5).max(80),
    description: z.string().min(20).max(5000),
    coverUrl: z.string().url().optional(),
    galleryUrls: z.array(z.string().url()).max(8).optional(),
    categoryId: z.string().optional(),
    tags: z.array(z.string().min(1).max(30)).max(8).optional(),
    faq: z
      .array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(1000) }))
      .max(10)
      .optional(),
    packages: z.array(packageSchema).min(1).max(3),
  })
  .strict();

/** Create a gig. Requires an active seller (or admin). */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  const gig = await createGig(user.id, body, user.role === "ADMIN");
  return ok({ id: gig.id, slug: gig.slug });
});
