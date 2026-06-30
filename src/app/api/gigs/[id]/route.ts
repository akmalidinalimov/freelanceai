import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import {
  pauseGig,
  resumeGig,
  softDeleteGig,
  approveGig,
  rejectGig,
  reportGig,
  setGigFeatured,
  updateGig,
} from "@/server/services/gig";

const schema = z
  .object({
    action: z.enum(["pause", "resume", "delete", "approve", "reject", "report", "feature", "unfeature"]),
  })
  .strict();

const packageSchema = z.object({
  tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
  title: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  priceUzs: z.number().int().min(1000).max(100_000_000),
  deliveryDays: z.number().int().min(1).max(90),
  revisions: z.number().int().min(0).max(20),
});

const editSchema = z
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
    extras: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          priceUzs: z.number().int().min(1000).max(100_000_000),
          deliveryDays: z.number().int().min(0).max(60).optional(),
        })
      )
      .max(6)
      .optional(),
    requirementPrompts: z.array(z.string().min(1).max(200)).max(8).optional(),
    packages: z.array(packageSchema).min(1).max(3),
  })
  .strict();

/** Owner gig management + admin moderation (approve/reject) + report. Authz enforced in the service. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const { action } = parseInput(schema, await request.json().catch(() => ({})));
    if (action === "pause") await pauseGig(id, user);
    else if (action === "resume") await resumeGig(id, user);
    else if (action === "delete") await softDeleteGig(id, user);
    else if (action === "approve") await approveGig(id, user);
    else if (action === "reject") await rejectGig(id, user);
    else if (action === "feature") await setGigFeatured(id, user, true);
    else if (action === "unfeature") await setGigFeatured(id, user, false);
    else await reportGig(id, user);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Edit a gig (owner or admin) — full replace of content + packages + extras. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const { id } = await params;
    const input = parseInput(editSchema, await request.json().catch(() => ({})));
    await updateGig(id, user, input);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
