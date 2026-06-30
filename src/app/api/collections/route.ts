import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import {
  createCollection,
  deleteCollection,
  assignSavedToCollection,
} from "@/server/services/collection";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("assign"),
    gigId: z.string().min(1).max(40),
    collectionId: z.string().max(40).nullable(),
  }),
]);

/** Manage a buyer's gig collections: create / delete / assign a saved gig. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const input = parseInput(schema, await request.json().catch(() => ({})));
    if (input.action === "create") await createCollection(user.id, input.name);
    else if (input.action === "delete") await deleteCollection(user.id, input.id);
    else await assignSavedToCollection(user.id, input.gigId, input.collectionId);
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
