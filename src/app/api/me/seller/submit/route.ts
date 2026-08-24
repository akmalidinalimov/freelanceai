import { defineHandler } from "@/lib/handler";
import { ok, Errors } from "@/lib/api";
import { submitForApproval } from "@/server/services/seller-approval";

/** Seller submits their profile for admin approval (INCOMPLETE/REJECTED → PENDING). */
export const POST = defineHandler({ auth: true }, async ({ user }) => {
  if (!user) throw Errors.unauthenticated();
  if (!user.isSeller) throw Errors.forbidden("Not a seller");
  const state = await submitForApproval(user.id);
  return ok(state);
});
