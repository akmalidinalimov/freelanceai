import { z } from "zod";
import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { requireSeller } from "@/lib/authz";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateGigDraft, templateGigDraft } from "@/server/services/gig-ai";

const schema = z
  .object({
    service: z.string().trim().min(2).max(200),
    deliverable: z.string().trim().min(2).max(500),
    days: z.number().int().min(1).max(365),
    priceUzs: z.number().int().min(1000).max(1_000_000_000),
    differentiator: z.string().trim().max(300).optional(),
    locale: z.enum(["uz", "ru", "en"]).default("uz"),
  })
  .strict();

/** Generate a structured gig draft from a few answers. Seller-only; never publishes. */
export const POST = defineHandler({ auth: true, schema }, async ({ user, body }) => {
  if (!user) throw Errors.unauthenticated();
  requireSeller(user);
  enforceRateLimit(`gig-ai:${user.id}`, 10, 60_000);
  const input = {
    service: body.service,
    deliverable: body.deliverable,
    days: body.days,
    priceUzs: body.priceUzs,
    ...(body.differentiator ? { differentiator: body.differentiator } : {}),
  };
  // Fail-open: if Claude is unavailable/over-budget, return the deterministic template draft so
  // the seller still gets a filled-in form instead of an error.
  const draft = (await generateGigDraft(input, body.locale ?? "uz")) ?? templateGigDraft(input);
  return ok({ draft, aiUsed: draft !== null });
});
