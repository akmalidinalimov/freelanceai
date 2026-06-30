import { z } from "zod";
import { ok, errorResponse, parseInput, Errors } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { createCategory, deleteCategory } from "@/server/services/category";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    slug: z.string().min(2).max(40),
    nameUz: z.string().min(1).max(60),
    nameRu: z.string().min(1).max(60),
    nameEn: z.string().min(1).max(60),
  }),
  z.object({ action: z.literal("delete"), id: z.string().min(1).max(40) }),
]);

/** Admin category management: create / delete. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw Errors.forbidden("Cross-origin request rejected");
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated();
    const input = parseInput(schema, await request.json().catch(() => ({})));
    if (input.action === "create") {
      await createCategory(user, {
        slug: input.slug,
        nameUz: input.nameUz,
        nameRu: input.nameRu,
        nameEn: input.nameEn,
      });
    } else {
      await deleteCategory(user, input.id);
    }
    return ok({ done: true });
  } catch (err) {
    return errorResponse(err);
  }
}
