import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { createSavedSearch, deleteSavedSearch } from "@/server/services/saved-search";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    q: z.string().max(100).optional(),
    categorySlug: z.string().max(60).optional(),
    minUzs: z.number().int().nonnegative().optional(),
    maxUzs: z.number().int().nonnegative().optional(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().min(1).max(40) }),
]);

/** Save or delete a buyer's saved search. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const input = parseInput(schema, await request.json().catch(() => ({})));
    if (input.action === "create") {
      await createSavedSearch(user.id, {
        q: input.q,
        categorySlug: input.categorySlug,
        minUzs: input.minUzs,
        maxUzs: input.maxUzs,
      });
    } else {
      await deleteSavedSearch(user.id, input.id);
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
